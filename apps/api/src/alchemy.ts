import { isValidEvmAddress } from "@repo/shared/validation";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Map CoinGecko network IDs to Alchemy network names
const NETWORK_MAP: Record<string, string> = {
	// Major L1s
	ethereum: "eth-mainnet",
	"binance-smart-chain": "bnb-mainnet",
	avalanche: "avax-mainnet",
	fantom: "fantom-mainnet",
	gnosis: "gnosis-mainnet",
	// Polygon ecosystem
	"polygon-pos": "polygon-mainnet",
	"polygon-zkevm": "polygonzkevm-mainnet",
	// Optimism ecosystem
	"optimistic-ethereum": "opt-mainnet",
	base: "base-mainnet",
	worldchain: "worldchain-mainnet",
	"zora-network": "zora-mainnet",
	// Arbitrum ecosystem
	"arbitrum-one": "arb-mainnet",
	"arbitrum-nova": "arbnova-mainnet",
	// Other L2s / scaling
	linea: "linea-mainnet",
	blast: "blast-mainnet",
	zksync: "zksync-mainnet",
	scroll: "scroll-mainnet",
	mantle: "mantle-mainnet",
	mode: "mode-mainnet",
	// Additional chains
	celo: "celo-mainnet",
	moonbeam: "moonbeam-mainnet",
	apechain: "apechain-mainnet",
	berachain: "berachain-mainnet",
};

export type TokenBalance = {
	contractAddress: string;
	balance: string;
	decimals: number;
	networkId: string;
};

// Alchemy API response types
interface AlchemyTokenBalance {
	contractAddress: string;
	tokenBalance: string;
}

interface AlchemyRpcResponse<T> {
	jsonrpc: string;
	id: number;
	result?: T;
	error?: { message: string };
}

interface AlchemyTokenBalancesResult {
	address: string;
	tokenBalances: AlchemyTokenBalance[];
}

// ERC-20 decimals() function selector
// NOTE: of course, in a more feature rich application that supports more complicated things we would use the ERC20 abi. This is fine for our use case here.
const DECIMALS_SELECTOR = "0x313ce567";

async function getTokenDecimals(
	alchemyNetwork: string,
	contractAddresses: string[],
): Promise<Map<string, number>> {
	if (!ALCHEMY_API_KEY || contractAddresses.length === 0) {
		return new Map();
	}

	const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

	// Batch eth_call requests for all tokens
	const calls = contractAddresses.map((address, index) => ({
		jsonrpc: "2.0",
		id: index,
		method: "eth_call",
		params: [{ to: address, data: DECIMALS_SELECTOR }, "latest"],
	}));

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(calls),
	});

	if (!res.ok) return new Map();

	const results = await res.json();
	const decimalsMap = new Map<string, number>();

	for (let i = 0; i < contractAddresses.length; i++) {
		const result = results[i];
		if (result?.result && result.result !== "0x") {
			const decimals = parseInt(result.result, 16);
			if (!Number.isNaN(decimals) && decimals <= 18) {
				decimalsMap.set(contractAddresses[i].toLowerCase(), decimals);
			}
		}
	}

	// Default to 18 for tokens that didn't return decimals
	for (const address of contractAddresses) {
		if (!decimalsMap.has(address.toLowerCase())) {
			decimalsMap.set(address.toLowerCase(), 18);
		}
	}

	return decimalsMap;
}

export function getSupportedNetworkIds(): string[] {
	return Object.keys(NETWORK_MAP);
}

// EIP-7528: Standard address for representing native tokens in ERC-20 contexts (https://eips.ethereum.org/EIPS/eip-7528)
export const NATIVE_TOKEN_ADDRESS =
	"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

async function getNativeBalance(
	alchemyNetwork: string,
	walletAddress: string,
): Promise<string | null> {
	if (!ALCHEMY_API_KEY) return null;

	const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "eth_getBalance",
			params: [walletAddress, "latest"],
		}),
	});

	if (!res.ok) return null;

	const data = await res.json();
	if (data.error || !data.result) return null;

	// Return null if balance is zero
	if (data.result === "0x0" || data.result === "0x") return null;

	return data.result;
}

export async function getTokenBalances(
	networkId: string,
	walletAddress: string,
	cachedDecimals?: Map<string, number>,
): Promise<TokenBalance[]> {
	if (!ALCHEMY_API_KEY) {
		throw new Error("ALCHEMY_API_KEY not configured");
	}

	if (!isValidEvmAddress(walletAddress)) {
		return [];
	}

	const alchemyNetwork = NETWORK_MAP[networkId];
	if (!alchemyNetwork) {
		return [];
	}

	const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

	// Fetch ERC-20 balances and native balance in parallel
	const [tokenRes, nativeBalance] = await Promise.all([
		fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "alchemy_getTokenBalances",
				params: [walletAddress, "erc20"],
			}),
		}),
		getNativeBalance(alchemyNetwork, walletAddress),
	]);

	if (!tokenRes.ok) throw new Error(`Alchemy API error: ${tokenRes.status}`);

	const data: AlchemyRpcResponse<AlchemyTokenBalancesResult> =
		await tokenRes.json();
	if (data.error) throw new Error(data.error.message);
	if (!data.result) throw new Error("No result from Alchemy API");

	const results: TokenBalance[] = [];

	// Add native token balance if non-zero
	if (nativeBalance) {
		results.push({
			contractAddress: NATIVE_TOKEN_ADDRESS,
			balance: nativeBalance,
			decimals: 18, // Native tokens always have 18 decimals
			networkId,
		});
	}

	const nonZeroBalances = data.result.tokenBalances.filter(
		(t) =>
			t.tokenBalance !==
			"0x0000000000000000000000000000000000000000000000000000000000000000",
	);

	if (nonZeroBalances.length > 0) {
		// Only fetch decimals via RPC for tokens not in cache
		const uncachedAddresses = nonZeroBalances
			.map((t) => t.contractAddress.toLowerCase())
			.filter((addr) => !cachedDecimals?.has(addr));

		const rpcDecimals =
			uncachedAddresses.length > 0
				? await getTokenDecimals(alchemyNetwork, uncachedAddresses)
				: new Map<string, number>();

		for (const t of nonZeroBalances) {
			const addr = t.contractAddress.toLowerCase();
			const decimals = cachedDecimals?.get(addr) ?? rpcDecimals.get(addr) ?? 18;
			results.push({
				contractAddress: addr,
				balance: t.tokenBalance,
				decimals,
				networkId,
			});
		}
	}

	return results;
}

export async function getAllTokenBalances(
	walletAddress: string,
	cachedDecimals?: Map<string, number>,
): Promise<TokenBalance[]> {
	if (!isValidEvmAddress(walletAddress)) {
		throw new Error("Invalid wallet address format");
	}

	const networkIds = getSupportedNetworkIds();
	const results = await Promise.all(
		networkIds.map((networkId) =>
			getTokenBalances(networkId, walletAddress, cachedDecimals).catch(
				() => [],
			),
		),
	);
	return results.flat();
}
