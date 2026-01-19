import { Express, Request, Response } from 'express'
import { z } from 'zod'
import { pool } from './db.js'
import { getTokenBalances } from './alchemy.js'

// Validation schemas
const TokensQuerySchema = z.object({
  networkId: z.string().optional(),
  search: z.string().optional(),
  wallet: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
})

// Types
interface Network {
  id: string
  chain_id: number
  name: string
  native_coin_id: string
}

interface Token {
  id: string
  symbol: string
  name: string
  contract_address: string | null
  network_id: string
  balance?: string
}

export function registerRoutes(app: Express) {
  app.get('/networks', async (_req: Request, res: Response) => {
    const { rows } = await pool.query<Network>(
      'SELECT id, chain_id, name, native_coin_id FROM networks ORDER BY name'
    )
    res.json(rows)
  })

  app.get('/tokens', async (req: Request, res: Response) => {
    const parsed = TokensQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const { networkId, search, wallet, page, limit } = parsed.data
    const offset = (page - 1) * limit

    // If wallet is provided, get balances and filter
    if (wallet && networkId) {
      const balances = await getTokenBalances(networkId, wallet)
      if (balances.length === 0) {
        res.json({ tokens: [], total: 0 })
        return
      }

      const addresses = balances.map(b => b.contractAddress)
      const { rows: tokens } = await pool.query<Token>(
        `SELECT t.id, t.symbol, t.name, t.contract_address, t.network_id
         FROM tokens t
         WHERE t.network_id = $1
           AND LOWER(t.contract_address) = ANY($2)
         ORDER BY t.name
         LIMIT $3 OFFSET $4`,
        [networkId, addresses, limit, offset]
      )

      const tokensWithBalances = tokens.map(token => ({
        ...token,
        balance: balances.find(b => b.contractAddress === token.contract_address?.toLowerCase())?.balance,
      }))

      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) as count FROM tokens
         WHERE network_id = $1
           AND LOWER(contract_address) = ANY($2)`,
        [networkId, addresses]
      )

      res.json({ tokens: tokensWithBalances, total: Number(countRows[0].count) })
      return
    }

    // Build query with conditions
    const conditions: string[] = []
    const params: (string | number)[] = []
    let paramIndex = 1

    if (networkId) {
      conditions.push(`network_id = $${paramIndex++}`)
      params.push(networkId)
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
