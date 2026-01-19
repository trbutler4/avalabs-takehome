const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

// Map CoinGecko network IDs to Alchemy network names
const NETWORK_MAP: Record<string, string> = {
  'ethereum': 'eth-mainnet',
  'polygon-pos': 'polygon-mainnet',
  'arbitrum-one': 'arb-mainnet',
  'optimistic-ethereum': 'opt-mainnet',
  'base': 'base-mainnet',
}

export type TokenBalance = {
  contractAddress: string
  balance: string
  networkId?: string
}

export function getSupportedNetworkIds(): string[] {
  return Object.keys(NETWORK_MAP)
}

export async function getTokenBalances(networkId: string, walletAddress: string): Promise<TokenBalance[]> {
  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured')
  }

  const alchemyNetwork = NETWORK_MAP[networkId]
  if (!alchemyNetwork) {
    return [] // Network not supported by Alchemy
  }

  const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenBalances',
      params: [walletAddress, 'erc20'],
    }),
  })

  if (!res.ok) throw new Error(`Alchemy API error: ${res.status}`)

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return data.result.tokenBalances
    .filter((t: any) => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
    .map((t: any) => ({
      contractAddress: t.contractAddress.toLowerCase(),
      balance: t.tokenBalance,
      networkId,
    }))
}

export async function getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  const networkIds = getSupportedNetworkIds()
  const results = await Promise.all(
    networkIds.map(networkId => getTokenBalances(networkId, walletAddress).catch(() => []))
  )
  return results.flat()
}
