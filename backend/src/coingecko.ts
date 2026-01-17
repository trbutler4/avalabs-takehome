import { sql } from './db.js'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// Rate limiter: max 30 requests per minute
let requestCount = 0
let windowStart = Date.now()

async function rateLimitedFetch(url: string) {
  const now = Date.now()
  if (now - windowStart > 60_000) {
    requestCount = 0
    windowStart = now
  }

  if (requestCount >= 30) {
    const waitTime = 60_000 - (now - windowStart)
    console.log(`Rate limit reached, waiting ${waitTime}ms`)
    await new Promise(r => setTimeout(r, waitTime))
    requestCount = 0
    windowStart = Date.now()
  }

  requestCount++
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
  return res.json()
}

export async function syncNetworks() {
  console.log('Syncing networks from CoinGecko...')
  const platforms = await rateLimitedFetch(`${COINGECKO_BASE}/asset_platforms`)

  for (const p of platforms) {
    if (!p.id) continue
    await sql`
      INSERT INTO networks (id, chain_id, name, native_coin_id, synced_at)
      VALUES (${p.id}, ${p.chain_identifier}, ${p.name}, ${p.native_coin_id}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        chain_id = EXCLUDED.chain_id,
        name = EXCLUDED.name,
        native_coin_id = EXCLUDED.native_coin_id,
        synced_at = NOW()
    `
  }
  console.log(`Synced ${platforms.length} networks`)
}

export async function syncTokens() {
  console.log('Syncing tokens from CoinGecko...')
  const coins = await rateLimitedFetch(`${COINGECKO_BASE}/coins/list?include_platform=true`)

  let count = 0
  for (const coin of coins) {
    if (!coin.platforms || Object.keys(coin.platforms).length === 0) continue

    for (const [networkId, contractAddress] of Object.entries(coin.platforms)) {
      if (!contractAddress) continue

      // Check if network exists
      const [network] = await sql`SELECT id FROM networks WHERE id = ${networkId}`
      if (!network) continue

      await sql`
        INSERT INTO tokens (id, network_id, symbol, name, contract_address, synced_at)
        VALUES (${coin.id}, ${networkId}, ${coin.symbol}, ${coin.name}, ${contractAddress as string}, NOW())
        ON CONFLICT (id, network_id) DO UPDATE SET
          symbol = EXCLUDED.symbol,
          name = EXCLUDED.name,
          contract_address = EXCLUDED.contract_address,
          synced_at = NOW()
      `
      count++
    }
  }
  console.log(`Synced ${count} tokens`)
}

export async function sync() {
  await syncNetworks()
  await syncTokens()
}
