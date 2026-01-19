import { Express, Request, Response } from 'express'
import { pool } from './db.js'
import { getTokenBalances, getAllTokenBalances } from './alchemy'
import { TokensQuerySchema, generateOpenAPIDocument } from './openapi'

// Types inferred from DB
type Network = {
  id: string
  chain_id: number
  name: string
  native_coin_id: string
}

type Token = {
  id: string
  symbol: string
  name: string
  contract_address: string | null
  network_id: string
  balance?: string
}

export function registerRoutes(app: Express) {
  // OpenAPI spec endpoint
  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(generateOpenAPIDocument())
  })

  app.get('/networks', async (_req: Request, res: Response) => {
    const { rows } = await pool.query<Network>(
      'SELECT id, chain_id, name, native_coin_id FROM networks ORDER BY name'
    )
    res.json(rows)
  })

  app.get('/tokens', async (req: Request, res: Response) => {
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
        const addresses = netBalances.map(b => b.contractAddress)
        const { rows } = await pool.query<Token>(
          `SELECT t.id, t.symbol, t.name, t.contract_address, t.network_id
           FROM tokens t
           WHERE t.network_id = $1
             AND LOWER(t.contract_address) = ANY($2)
           ORDER BY t.name`,
          [netId, addresses]
        )

        const tokensWithBalances = rows.map(token => ({
          ...token,
          balance: netBalances.find(b => b.contractAddress === token.contract_address?.toLowerCase())?.balance,
        }))

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

    const { rows: tokens } = await pool.query<Token>(
      `SELECT id, symbol, name, contract_address, network_id
       FROM tokens
       ${where}
       ORDER BY name
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    )

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM tokens ${where}`,
      params
    )

    res.json({ tokens, total: Number(countRows[0].count) })
  })
}
