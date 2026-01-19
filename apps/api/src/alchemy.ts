const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY

// Map CoinGecko network IDs to Alchemy network names
// EVM chains use alchemy_getTokenBalances
const EVM_NETWORK_MAP: Record<string, string> = {
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

// Solana uses different RPC methods
const SOLANA_NETWORK_MAP: Record<string, string> = {
  'solana': 'solana-mainnet',
}

// Address validation patterns
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export type TokenBalance = {
  contractAddress: string
  balance: string
  networkId?: string
}

export type AddressType = 'evm' | 'solana' | 'unknown'

export function detectAddressType(address: string): AddressType {
  if (EVM_ADDRESS_REGEX.test(address)) return 'evm'
  if (SOLANA_ADDRESS_REGEX.test(address)) return 'solana'
  return 'unknown'
}

export function isValidWalletAddress(address: string): boolean {
  return detectAddressType(address) !== 'unknown'
}

export function getSupportedNetworkIds(): string[] {
  return [...Object.keys(EVM_NETWORK_MAP), ...Object.keys(SOLANA_NETWORK_MAP)]
}

export function getEvmNetworkIds(): string[] {
  return Object.keys(EVM_NETWORK_MAP)
}

export function getSolanaNetworkIds(): string[] {
  return Object.keys(SOLANA_NETWORK_MAP)
}

async function getEvmTokenBalances(networkId: string, walletAddress: string): Promise<TokenBalance[]> {
  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured')
  }

  const alchemyNetwork = EVM_NETWORK_MAP[networkId]
  if (!alchemyNetwork) {
    return []
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

async function getSolanaTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured')
  }

  const url = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Alchemy Solana API error: ${res.status}`)

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return (data.result?.value || [])
    .filter((account: any) => {
      const amount = account.account?.data?.parsed?.info?.tokenAmount?.amount
      return amount && amount !== '0'
    })
    .map((account: any) => ({
      contractAddress: account.account.data.parsed.info.mint,
      balance: account.account.data.parsed.info.tokenAmount.amount,
      networkId: 'solana',
    }))
}

export async function getTokenBalances(networkId: string, walletAddress: string): Promise<TokenBalance[]> {
  const addressType = detectAddressType(walletAddress)

  if (networkId === 'solana') {
    if (addressType !== 'solana') return []
    return getSolanaTokenBalances(walletAddress)
  }

  if (addressType !== 'evm') return []
  return getEvmTokenBalances(networkId, walletAddress)
}

export async function getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  const addressType = detectAddressType(walletAddress)

  if (addressType === 'unknown') {
    throw new Error('Invalid wallet address format')
  }

  if (addressType === 'solana') {
    return getSolanaTokenBalances(walletAddress)
  }

  // EVM address - query all EVM networks
  const networkIds = getEvmNetworkIds()
  const results = await Promise.all(
    networkIds.map(networkId => getEvmTokenBalances(networkId, walletAddress).catch(() => []))
  )
  return results.flat()
}
