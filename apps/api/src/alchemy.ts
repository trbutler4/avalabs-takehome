const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

// Map CoinGecko network IDs to Alchemy network names
const NETWORK_MAP: Record<string, string> = {
  // Major L1s
  'ethereum': 'eth-mainnet',
  'binance-smart-chain': 'bnb-mainnet',
  'avalanche': 'avax-mainnet',
  'fantom': 'fantom-mainnet',
  'gnosis': 'gnosis-mainnet',
  // Polygon ecosystem
  'polygon-pos': 'polygon-mainnet',
  'polygon-zkevm': 'polygonzkevm-mainnet',
  // Optimism ecosystem
  'optimistic-ethereum': 'opt-mainnet',
  'base': 'base-mainnet',
  'worldchain': 'worldchain-mainnet',
  'zora-network': 'zora-mainnet',
  // Arbitrum ecosystem
  'arbitrum-one': 'arb-mainnet',
  'arbitrum-nova': 'arbnova-mainnet',
  // Other L2s / scaling
  'linea': 'linea-mainnet',
  'blast': 'blast-mainnet',
  'zksync': 'zksync-mainnet',
  'scroll': 'scroll-mainnet',
  'mantle': 'mantle-mainnet',
  'mode': 'mode-mainnet',
  // Additional chains
  'celo': 'celo-mainnet',
  'moonbeam': 'moonbeam-mainnet',
  'apechain': 'apechain-mainnet',
  'berachain': 'berachain-mainnet',
}

// EVM address validation
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

export type TokenBalance = {
  contractAddress: string
  balance: string
  decimals: number
  networkId: string
}

// ERC-20 decimals() function selector
const DECIMALS_SELECTOR = '0x313ce567'

async function getTokenDecimals(
  alchemyNetwork: string,
  contractAddresses: string[]
): Promise<Map<string, number>> {
  if (!ALCHEMY_API_KEY || contractAddresses.length === 0) {
    return new Map()
  }

  const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  // Batch eth_call requests for all tokens
  const calls = contractAddresses.map((address, index) => ({
    jsonrpc: '2.0',
    id: index,
    method: 'eth_call',
    params: [{ to: address, data: DECIMALS_SELECTOR }, 'latest'],
  }))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calls),
  })

  if (!res.ok) return new Map()

  const results = await res.json()
  const decimalsMap = new Map<string, number>()

  for (let i = 0; i < contractAddresses.length; i++) {
    const result = results[i]
    if (result?.result && result.result !== '0x') {
      const decimals = parseInt(result.result, 16)
      if (!isNaN(decimals) && decimals <= 18) {
        decimalsMap.set(contractAddresses[i].toLowerCase(), decimals)
      }
    }
  }

  // Default to 18 for tokens that didn't return decimals
  for (const address of contractAddresses) {
    if (!decimalsMap.has(address.toLowerCase())) {
      decimalsMap.set(address.toLowerCase(), 18)
    }
  }

  return decimalsMap
}

export function isValidWalletAddress(address: string): boolean {
  return EVM_ADDRESS_REGEX.test(address)
}

export function getSupportedNetworkIds(): string[] {
  return Object.keys(NETWORK_MAP)
}

// Native token uses zero address as identifier
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

async function getNativeBalance(alchemyNetwork: string, walletAddress: string): Promise<string | null> {
  if (!ALCHEMY_API_KEY) return null

  const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [walletAddress, 'latest'],
    }),
  })

  if (!res.ok) return null

  const data = await res.json()
  if (data.error || !data.result) return null

  // Return null if balance is zero
  if (data.result === '0x0' || data.result === '0x') return null

  return data.result
}

export async function getTokenBalances(networkId: string, walletAddress: string): Promise<TokenBalance[]> {
  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured')
  }

  if (!isValidWalletAddress(walletAddress)) {
    return []
  }

  const alchemyNetwork = NETWORK_MAP[networkId]
  if (!alchemyNetwork) {
    return []
  }

  const url = `https://${alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  // Fetch ERC-20 balances and native balance in parallel
  const [tokenRes, nativeBalance] = await Promise.all([
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenBalances',
        params: [walletAddress, 'erc20'],
      }),
    }),
    getNativeBalance(alchemyNetwork, walletAddress),
  ])

  if (!tokenRes.ok) throw new Error(`Alchemy API error: ${tokenRes.status}`)

  const data = await tokenRes.json()
  if (data.error) throw new Error(data.error.message)

  const results: TokenBalance[] = []

  // Add native token balance if non-zero
  if (nativeBalance) {
    results.push({
      contractAddress: NATIVE_TOKEN_ADDRESS,
      balance: nativeBalance,
      decimals: 18, // Native tokens always have 18 decimals
      networkId,
    })
  }

  const nonZeroBalances = data.result.tokenBalances.filter(
    (t: any) => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
  )

  if (nonZeroBalances.length > 0) {
    // Fetch decimals for all tokens in batch
    const contractAddresses = nonZeroBalances.map((t: any) => t.contractAddress)
    const decimalsMap = await getTokenDecimals(alchemyNetwork, contractAddresses)

    for (const t of nonZeroBalances) {
      results.push({
        contractAddress: t.contractAddress.toLowerCase(),
        balance: t.tokenBalance,
        decimals: decimalsMap.get(t.contractAddress.toLowerCase()) ?? 18,
        networkId,
      })
    }
  }

  return results
}

export async function getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  if (!isValidWalletAddress(walletAddress)) {
    throw new Error('Invalid wallet address format')
  }

  const networkIds = getSupportedNetworkIds()
  const results = await Promise.all(
    networkIds.map(networkId => getTokenBalances(networkId, walletAddress).catch(() => []))
  )
  return results.flat()
}
