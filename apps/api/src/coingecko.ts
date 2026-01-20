import { getSupportedNetworkIds } from "./alchemy.js";
import { db } from "./db.js";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// CoinGecko API response types
interface CoinGeckoPlatform {
	id: string;
	chain_identifier: number | null;
	name: string;
	native_coin_id: string | null;
}

interface CoinGeckoCoin {
	id: string;
	symbol: string;
	name: string;
	platforms?: Record<string, string>;
}

// Only sync networks we have RPC support for
const SUPPORTED_NETWORKS = new Set(getSupportedNetworkIds());

// Rate limiter: max 30 requests per minute
let requestCount = 0;
let windowStart = Date.now();

async function rateLimitedFetch(url: string) {
	const now = Date.now();
	if (now - windowStart > 60_000) {
		requestCount = 0;
		windowStart = now;
	}

	if (requestCount >= 30) {
		const waitTime = 60_000 - (now - windowStart);
		console.warn(`Rate limit reached, waiting ${waitTime}ms`);
		await new Promise((r) => setTimeout(r, waitTime));
		requestCount = 0;
		windowStart = Date.now();
	}

	requestCount++;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
	return res.json();
}

export async function syncNetworks() {
	console.info("Syncing networks from CoinGecko...");
	const platforms: CoinGeckoPlatform[] = await rateLimitedFetch(
		`${COINGECKO_BASE}/asset_platforms`,
	);

	// Filter to only networks we have RPC support for
	const supportedPlatforms = platforms.filter(
		(p) => p.id && SUPPORTED_NETWORKS.has(p.id),
	);

	for (const p of supportedPlatforms) {
		await db.none(
			`INSERT INTO networks (id, chain_id, name, native_coin_id, synced_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         chain_id = EXCLUDED.chain_id,
         name = EXCLUDED.name,
         native_coin_id = EXCLUDED.native_coin_id,
         synced_at = NOW()`,
			[p.id, p.chain_identifier, p.name, p.native_coin_id],
		);
	}
	console.info(
		`Synced ${supportedPlatforms.length} networks (filtered from ${platforms.length} total)`,
	);
}

export async function syncTokens() {
	console.info("Syncing tokens from CoinGecko...");
	const coins: CoinGeckoCoin[] = await rateLimitedFetch(
		`${COINGECKO_BASE}/coins/list?include_platform=true`,
	);

	let count = 0;
	for (const coin of coins) {
		if (!coin.platforms || Object.keys(coin.platforms).length === 0) continue;

		for (const [networkId, contractAddress] of Object.entries(coin.platforms)) {
			if (!contractAddress) continue;

			// Skip networks we don't have RPC support for
			if (!SUPPORTED_NETWORKS.has(networkId)) continue;

			await db.none(
				`INSERT INTO tokens (id, network_id, symbol, name, contract_address, synced_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id, network_id) DO UPDATE SET
           symbol = EXCLUDED.symbol,
           name = EXCLUDED.name,
           contract_address = EXCLUDED.contract_address,
           synced_at = NOW()`,
				[coin.id, networkId, coin.symbol, coin.name, contractAddress],
			);
			count++;
		}
	}
	console.info(`Synced ${count} tokens`);
}

// PostgreSQL advisory lock ID for preventing concurrent syncs across instances.
// NOTE: This is likely unnecessary for a single-instance deployment, but included
// to demonstrate production-readiness for horizontal scaling scenarios.
const SYNC_LOCK_ID = 1234567890;

export async function sync() {
	// Try to acquire advisory lock (non-blocking)
	const { acquired } = await db.one<{ acquired: boolean }>(
		"SELECT pg_try_advisory_lock($1) as acquired",
		[SYNC_LOCK_ID],
	);

	if (!acquired) {
		console.warn("Another instance is already syncing, skipping...");
		return;
	}

	try {
		await syncNetworks();
		await syncTokens();
	} finally {
		// Release the lock (returns boolean, so use oneOrNone)
		await db.oneOrNone("SELECT pg_advisory_unlock($1)", [SYNC_LOCK_ID]);
	}
}
