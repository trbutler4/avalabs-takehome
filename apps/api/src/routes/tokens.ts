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

// Native token symbols by network
const NATIVE_SYMBOLS: Record<string, { symbol: string; name: string }> = {
	ethereum: { symbol: "ETH", name: "Ether" },
	"polygon-pos": { symbol: "POL", name: "POL" },
	"arbitrum-one": { symbol: "ETH", name: "Ether" },
	"optimistic-ethereum": { symbol: "ETH", name: "Ether" },
	base: { symbol: "ETH", name: "Ether" },
	"binance-smart-chain": { symbol: "BNB", name: "BNB" },
	avalanche: { symbol: "AVAX", name: "Avalanche" },
	fantom: { symbol: "FTM", name: "Fantom" },
	gnosis: { symbol: "xDAI", name: "xDAI" },
	linea: { symbol: "ETH", name: "Ether" },
	blast: { symbol: "ETH", name: "Ether" },
	zksync: { symbol: "ETH", name: "Ether" },
	scroll: { symbol: "ETH", name: "Ether" },
	mantle: { symbol: "MNT", name: "Mantle" },
	celo: { symbol: "CELO", name: "Celo" },
	moonbeam: { symbol: "GLMR", name: "Glimmer" },
};

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

	// Separate native tokens (no DB lookup needed) from ERC-20 tokens
	const tokens: Token[] = [];
	const erc20Balances: TokenBalance[] = [];

	for (const b of balances) {
		if (!b.networkId) continue;

		if (b.contractAddress === NATIVE_TOKEN_ADDRESS) {
			const nativeInfo = NATIVE_SYMBOLS[b.networkId] ?? {
				symbol: "NATIVE",
				name: "Native Token",
			};
			tokens.push({
				id: `${b.networkId}-native`,
				symbol: nativeInfo.symbol,
				name: nativeInfo.name,
				contract_address: null,
				network_id: b.networkId,
				balance: b.balance,
				decimals: b.decimals,
			});
		} else {
			erc20Balances.push(b);
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
			const tokens = await getTokensWithBalances(wallet, network_id);
			tokens.sort((a, b) => a.name.localeCompare(b.name));
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
		if (search) {
			const term = `%${search.toLowerCase()}%`;
			conditions.push(`(
        LOWER(symbol) LIKE $${paramIndex}
        OR LOWER(name) LIKE $${paramIndex}
        OR LOWER(contract_address) LIKE $${paramIndex}
      )`);
			paramIndex++;
			params.push(term);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

		const tokens = await db.manyOrNone<Token>(
			`SELECT id, symbol, name, contract_address, network_id
       FROM tokens
       ${where}
       ORDER BY name
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
			[...params, limit, offset],
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
