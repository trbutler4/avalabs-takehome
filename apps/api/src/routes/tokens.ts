import type { Token } from "@repo/shared";
import { Router } from "express";
import {
	getAllTokenBalances,
	getTokenBalances,
	NATIVE_TOKEN_ADDRESS,
	type TokenBalance,
} from "../alchemy.js";
import { db } from "../db.js";
import { TokensQuerySchema } from "../openapi.js";

const router = Router();

// Lower score = higher relevance
function getSearchRelevanceScore(token: Token, term: string): number {
	const symbol = token.symbol.toLowerCase();
	const name = token.name.toLowerCase();

	if (symbol === term) return 0; // Exact symbol match
	if (name === term) return 1; // Exact name match
	if (symbol.startsWith(term)) return 2; // Symbol starts with
	if (name.startsWith(term)) return 3; // Name starts with
	return 4; // Contains match
}

async function getTokensWithBalances(
	wallet: string,
	networkId?: string,
): Promise<Token[]> {
	// Load cached decimals from DB to avoid unnecessary RPC calls
	const cachedRows = await db.manyOrNone<{
		contract_address: string;
		decimals: number;
	}>(
		`SELECT LOWER(contract_address) as contract_address, decimals
		FROM tokens
		WHERE decimals IS NOT NULL${networkId ? " AND network_id = $1" : ""}`,
		networkId ? [networkId] : [],
	);
	const cachedDecimals = new Map(
		cachedRows.map((r) => [r.contract_address, r.decimals]),
	);

	const balances = networkId
		? await getTokenBalances(networkId, wallet, cachedDecimals)
		: await getAllTokenBalances(wallet, cachedDecimals);

	if (balances.length === 0) return [];

	// Separate native tokens from ERC-20 tokens
	const tokens: Token[] = [];
	const erc20Balances: TokenBalance[] = [];
	const nativeBalances: (TokenBalance & { networkId: string })[] = [];

	for (const b of balances) {
		if (!b.networkId) continue;

		if (b.contractAddress === NATIVE_TOKEN_ADDRESS) {
			nativeBalances.push(b as TokenBalance & { networkId: string });
		} else {
			erc20Balances.push(b);
		}
	}

	// Look up native tokens from DB
	if (nativeBalances.length > 0) {
		const networkIds = nativeBalances.map((b) => b.networkId);
		const nativeRows = await db.manyOrNone<Token>(
			`SELECT id, symbol, name, contract_address, network_id
			FROM tokens
			WHERE contract_address IS NULL AND network_id = ANY($1::text[])`,
			[networkIds],
		);

		const nativeMap = new Map(nativeRows.map((r) => [r.network_id, r]));

		for (const b of nativeBalances) {
			const nativeToken = nativeMap.get(b.networkId);
			if (nativeToken) {
				tokens.push({
					...nativeToken,
					balance: b.balance,
					decimals: b.decimals,
				});
			}
		}
	}

	// Single batched query for all ERC-20 tokens across all networks
	if (erc20Balances.length > 0) {
		const networkIds = erc20Balances.map((b) => b.networkId);
		const addresses = erc20Balances.map((b) => b.contractAddress);

		const rows = await db.manyOrNone<Token & { decimals: number | null }>(
			`SELECT t.id, t.symbol, t.name, t.contract_address, t.network_id, t.decimals
			FROM tokens t
			JOIN unnest($1::text[], $2::text[]) AS params(network_id, contract_address)
				ON t.network_id = params.network_id
				AND LOWER(t.contract_address) = params.contract_address
			ORDER BY t.name`,
			[networkIds, addresses],
		);

		// Create lookup map for balances (normalize addresses to lowercase)
		const balanceMap = new Map(
			erc20Balances.map((b) => [
				`${b.networkId}:${b.contractAddress.toLowerCase()}`,
				b,
			]),
		);

		for (const token of rows) {
			const key = `${token.network_id}:${token.contract_address?.toLowerCase()}`;
			const balanceInfo = balanceMap.get(key);
			const decimals = token.decimals ?? balanceInfo?.decimals ?? 18;

			tokens.push({
				...token,
				balance: balanceInfo?.balance,
				decimals,
			});

			// Cache newly discovered decimals (fire and forget)
			if (token.decimals === null && decimals !== undefined) {
				db.none(
					"UPDATE tokens SET decimals = $1 WHERE id = $2 AND network_id = $3",
					[decimals, token.id, token.network_id],
				).catch((err) => console.error("Failed to cache decimals:", err));
			}
		}
	}

	return tokens;
}

router.get("/", async (req, res) => {
	const parsed = TokensQuerySchema.safeParse(req.query);
	if (!parsed.success) {
		res.status(400).json({ error: parsed.error.issues });
		return;
	}

	try {
		const { network_id, search, wallet, page, limit } = parsed.data;
		const offset = (page - 1) * limit;

		// If wallet is provided, get balances and filter
		if (wallet) {
			let tokens = await getTokensWithBalances(wallet, network_id);

			// Apply search filter and relevance sorting
			if (search) {
				const term = search.toLowerCase();
				tokens = tokens
					.filter(
						(t) =>
							t.symbol.toLowerCase().includes(term) ||
							t.name.toLowerCase().includes(term) ||
							t.contract_address?.toLowerCase().includes(term),
					)
					.sort((a, b) => {
						const scoreA = getSearchRelevanceScore(a, term);
						const scoreB = getSearchRelevanceScore(b, term);
						return scoreA !== scoreB
							? scoreA - scoreB
							: a.name.localeCompare(b.name);
					});
			} else {
				tokens.sort((a, b) => a.name.localeCompare(b.name));
			}

			const paginatedTokens = tokens.slice(offset, offset + limit);
			res.json({ tokens: paginatedTokens, total: tokens.length });
			return;
		}

		// Build query with conditions
		const conditions: string[] = [];
		const params: (string | number)[] = [];
		let paramIndex = 1;

		if (network_id) {
			conditions.push(`network_id = $${paramIndex++}`);
			params.push(network_id);
		}
		// For search, we need both the LIKE term and exact term for relevance scoring
		let searchTerm = "";
		if (search) {
			searchTerm = search.toLowerCase();
			const likeTerm = `%${searchTerm}%`;
			conditions.push(`(
        LOWER(symbol) LIKE $${paramIndex}
        OR LOWER(name) LIKE $${paramIndex}
        OR LOWER(contract_address) LIKE $${paramIndex}
      )`);
			paramIndex++;
			params.push(likeTerm);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		// Build ORDER BY clause with relevance scoring when searching
		const orderBy = search
			? `ORDER BY
        CASE
          WHEN LOWER(symbol) = $${paramIndex} THEN 0
          WHEN LOWER(name) = $${paramIndex} THEN 1
          WHEN LOWER(symbol) LIKE $${paramIndex} || '%' THEN 2
          WHEN LOWER(name) LIKE $${paramIndex} || '%' THEN 3
          ELSE 4
        END,
        name`
			: "ORDER BY name";

		const queryParams = search
			? [...params, searchTerm, limit, offset]
			: [...params, limit, offset];

		const tokens = await db.manyOrNone<Token>(
			`SELECT id, symbol, name, contract_address, network_id
       FROM tokens
       ${where}
       ${orderBy}
       LIMIT $${search ? paramIndex + 1 : paramIndex++} OFFSET $${search ? paramIndex + 2 : paramIndex}`,
			queryParams,
		);

		const { count } = await db.one<{ count: string }>(
			`SELECT COUNT(*) as count FROM tokens ${where}`,
			params,
		);

		res.json({ tokens, total: Number(count) });
	} catch (err) {
		console.error("Failed to fetch tokens:", err);
		res.status(500).json({ error: "Failed to fetch tokens" });
	}
});

export default router;
