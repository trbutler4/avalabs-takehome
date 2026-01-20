import { Router } from 'express'
import type { Token } from '@repo/shared'
import { db } from '../db.js'
import { getTokenBalances, getAllTokenBalances } from '../alchemy.js'
import { TokensQuerySchema } from '../openapi.js'

const router = Router()

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

// Native token symbols by network
const NATIVE_SYMBOLS: Record<string, { symbol: string; name: string }> = {
  'ethereum': { symbol: 'ETH', name: 'Ether' },
  'polygon-pos': { symbol: 'POL', name: 'POL' },
  'arbitrum-one': { symbol: 'ETH', name: 'Ether' },
  'optimistic-ethereum': { symbol: 'ETH', name: 'Ether' },
  'base': { symbol: 'ETH', name: 'Ether' },
  'binance-smart-chain': { symbol: 'BNB', name: 'BNB' },
  'avalanche': { symbol: 'AVAX', name: 'Avalanche' },
  'fantom': { symbol: 'FTM', name: 'Fantom' },
  'gnosis': { symbol: 'xDAI', name: 'xDAI' },
  'linea': { symbol: 'ETH', name: 'Ether' },
  'blast': { symbol: 'ETH', name: 'Ether' },
  'zksync': { symbol: 'ETH', name: 'Ether' },
  'scroll': { symbol: 'ETH', name: 'Ether' },
  'mantle': { symbol: 'MNT', name: 'Mantle' },
  'celo': { symbol: 'CELO', name: 'Celo' },
  'moonbeam': { symbol: 'GLMR', name: 'Glimmer' },
}

router.get('/', async (req, res) => {
  const parsed = TokensQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues })
    return
  }

  const { network_id, search, wallet, page, limit } = parsed.data
  const offset = (page - 1) * limit

  // If wallet is provided, get balances and filter
  if (wallet) {
    const balances = network_id
      ? await getTokenBalances(network_id, wallet)
      : await getAllTokenBalances(wallet)

    if (balances.length === 0) {
      res.json({ tokens: [], total: 0 })
      return
    }

    // Group balances by network for efficient querying
    const balancesByNetwork = new Map<string, typeof balances>()
    for (const b of balances) {
      if (!b.networkId) continue
      const existing = balancesByNetwork.get(b.networkId) ?? []
      existing.push(b)
      balancesByNetwork.set(b.networkId, existing)
    }

    // Build query to find tokens across networks
    let tokens: Token[] = []
    let total = 0

    for (const [netId, netBalances] of balancesByNetwork) {
      // Handle native token separately
      const nativeBalance = netBalances.find(b => b.contractAddress === NATIVE_TOKEN_ADDRESS)
      if (nativeBalance) {
        const nativeInfo = NATIVE_SYMBOLS[netId] ?? { symbol: 'NATIVE', name: 'Native Token' }
        tokens.push({
          id: `${netId}-native`,
          symbol: nativeInfo.symbol,
          name: nativeInfo.name,
          contract_address: null,
          network_id: netId,
          balance: nativeBalance.balance,
          decimals: nativeBalance.decimals,
        })
        total++
      }

      // Handle ERC-20 tokens
      const erc20Balances = netBalances.filter(b => b.contractAddress !== NATIVE_TOKEN_ADDRESS)
      if (erc20Balances.length === 0) continue

      const addresses = erc20Balances.map(b => b.contractAddress)
      const rows = await db.manyOrNone<Token>(
        `SELECT t.id, t.symbol, t.name, t.contract_address, t.network_id
         FROM tokens t
         WHERE t.network_id = $1
           AND LOWER(t.contract_address) = ANY($2)
         ORDER BY t.name`,
        [netId, addresses]
      )

      const tokensWithBalances = rows.map(token => {
        const balanceInfo = erc20Balances.find(b => b.contractAddress === token.contract_address?.toLowerCase())
        return {
          ...token,
          balance: balanceInfo?.balance,
          decimals: balanceInfo?.decimals,
        }
      })

      tokens = tokens.concat(tokensWithBalances)
      total += rows.length
    }

    // Apply pagination after aggregating
    tokens.sort((a, b) => a.name.localeCompare(b.name))
    const paginatedTokens = tokens.slice(offset, offset + limit)

    res.json({ tokens: paginatedTokens, total })
    return
  }

  // Build query with conditions
  const conditions: string[] = []
  const params: (string | number)[] = []
  let paramIndex = 1

  if (network_id) {
    conditions.push(`network_id = $${paramIndex++}`)
    params.push(network_id)
  }
  if (search) {
    const term = `%${search.toLowerCase()}%`
    conditions.push(`(
      LOWER(symbol) LIKE $${paramIndex}
      OR LOWER(name) LIKE $${paramIndex}
      OR LOWER(contract_address) LIKE $${paramIndex}
    )`)
    paramIndex++
    params.push(term)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const tokens = await db.manyOrNone<Token>(
    `SELECT id, symbol, name, contract_address, network_id
     FROM tokens
     ${where}
     ORDER BY name
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  )

  const { count } = await db.one<{ count: string }>(
    `SELECT COUNT(*) as count FROM tokens ${where}`,
    params
  )

  res.json({ tokens, total: Number(count) })
})

export default router
