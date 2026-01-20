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

async function getTokensWithBalances(
	wallet: string,
	networkId?: string,
): Promise<Token[]> {
	// Load known decimals from DB to avoid redundant RPC calls
	const decimalRows = await db.manyOrNone<{
		contract_address: string;
		decimals: number;
	}>(
		`SELECT LOWER(contract_address) as contract_address, decimals
		FROM tokens
		WHERE decimals IS NOT NULL${networkId ? " AND network_id = $1" : ""}`,
		networkId ? [networkId] : [],
	);
	const knownDecimals = new Map(
		decimalRows.map((r) => [r.contract_address, r.decimals]),
	);

	const balances = networkId
		? await getTokenBalances(networkId, wallet, knownDecimals)
		: await getAllTokenBalances(wallet, knownDecimals);

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

			// Save decimals discovered from RPC for future queries
			if (token.decimals === null && decimals !== undefined) {
				db.none(
					"UPDATE tokens SET decimals = $1 WHERE id = $2 AND network_id = $3",
					[decimals, token.id, token.network_id],
				).catch((err) => console.error("Failed to save decimals:", err));
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

		// Wallet query: fetch balances from Alchemy, filter/paginate in-memory
		if (wallet) {
			let tokens = await getTokensWithBalances(wallet, network_id);

			// Apply search filter if provided
			if (search) {
				const term = search.toLowerCase();
				tokens = tokens.filter(
					(t) =>
						t.symbol.toLowerCase().includes(term) ||
						t.name.toLowerCase().includes(term) ||
						t.contract_address?.toLowerCase().includes(term),
				);
			}

			tokens.sort((a, b) => a.name.localeCompare(b.name));
			const total = tokens.length;
			tokens = tokens.slice(offset, offset + limit);
			res.json({ tokens, total });
			return;
		}

		// Database query: filter and sort in SQL
		const term = search?.toLowerCase();
		const likeTerm = term ? `%${term}%` : null;

		// Use explicit queries for clarity instead of dynamic query building
		const tokens = await db.manyOrNone<Token>(
			`SELECT id, symbol, name, contract_address, network_id
			FROM tokens
			WHERE ($1::text IS NULL OR network_id = $1)
			  AND ($2::text IS NULL OR LOWER(symbol) LIKE $2 OR LOWER(name) LIKE $2 OR LOWER(contract_address) LIKE $2)
			ORDER BY
				CASE WHEN $3::text IS NULL THEN NULL
					WHEN LOWER(symbol) = $3 THEN 0
					WHEN LOWER(name) = $3 THEN 1
					WHEN LOWER(symbol) LIKE $3 || '%' THEN 2
					WHEN LOWER(name) LIKE $3 || '%' THEN 3
					ELSE 4
				END NULLS LAST,
				name
			LIMIT $4 OFFSET $5`,
			[network_id ?? null, likeTerm, term ?? null, limit, offset],
		);

		const { count } = await db.one<{ count: string }>(
			`SELECT COUNT(*) FROM tokens
			WHERE ($1::text IS NULL OR network_id = $1)
			  AND ($2::text IS NULL OR LOWER(symbol) LIKE $2 OR LOWER(name) LIKE $2 OR LOWER(contract_address) LIKE $2)`,
			[network_id ?? null, likeTerm],
		);

		res.json({ tokens, total: Number(count) });
	} catch (err) {
		console.error("Failed to fetch tokens:", err);
		res.status(500).json({ error: "Failed to fetch tokens" });
	}
});

export default router;
