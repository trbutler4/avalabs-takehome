import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { sql } from './db.js'
import { getTokenBalances } from './alchemy.js'

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
}

interface TokenWithBalance extends Token {
  balance?: string
}

const t = initTRPC.create()

export const appRouter = t.router({
  networks: t.procedure.query(async () => {
    const networks = await sql<Network[]>`
      SELECT id, chain_id, name, native_coin_id
      FROM networks
      ORDER BY name
    `
    return networks
  }),

  tokens: t.procedure
    .input(z.object({
      networkId: z.string().optional(),
      search: z.string().optional(),
      wallet: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const { networkId, search, wallet, page, limit } = input
      const offset = (page - 1) * limit

      // If wallet is provided, get balances and filter
      if (wallet && networkId) {
        const balances = await getTokenBalances(networkId, wallet)
        if (balances.length === 0) return { tokens: [], total: 0 }

        const addresses = balances.map(b => b.contractAddress)
        const tokens = await sql<Token[]>`
          SELECT t.id, t.symbol, t.name, t.contract_address, t.network_id
          FROM tokens t
          WHERE t.network_id = ${networkId}
            AND LOWER(t.contract_address) = ANY(${addresses})
          ORDER BY t.name
          LIMIT ${limit} OFFSET ${offset}
        `

        // Attach balances to tokens
        const tokensWithBalances: TokenWithBalance[] = tokens.map(token => ({
          ...token,
          balance: balances.find(b => b.contractAddress === token.contract_address?.toLowerCase())?.balance,
        }))

        const [{ count }] = await sql`
          SELECT COUNT(*) as count FROM tokens
          WHERE network_id = ${networkId}
            AND LOWER(contract_address) = ANY(${addresses})
        `

        return { tokens: tokensWithBalances, total: Number(count) }
      }

      // Build query conditions
      const conditions = []
      if (networkId) conditions.push(sql`network_id = ${networkId}`)
      if (search) {
        const term = `%${search.toLowerCase()}%`
        conditions.push(sql`(
          LOWER(symbol) LIKE ${term}
          OR LOWER(name) LIKE ${term}
          OR LOWER(contract_address) LIKE ${term}
        )`)
      }

      const where = conditions.length > 0
        ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
        : sql``

      const tokens = await sql<Token[]>`
        SELECT id, symbol, name, contract_address, network_id
        FROM tokens
        ${where}
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `

      const [{ count }] = await sql`SELECT COUNT(*) as count FROM tokens ${where}`

      return { tokens, total: Number(count) }
    }),
})

export type AppRouter = typeof appRouter
