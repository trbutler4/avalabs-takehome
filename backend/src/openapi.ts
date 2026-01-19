import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// Network schema
export const NetworkSchema = z.object({
  id: z.string().openapi({ example: 'ethereum' }),
  chain_id: z.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'Ethereum' }),
  native_coin_id: z.string().openapi({ example: 'ethereum' }),
}).openapi('Network')

// Token schema
export const TokenSchema = z.object({
  id: z.string().openapi({ example: 'usd-coin' }),
  symbol: z.string().openapi({ example: 'USDC' }),
  name: z.string().openapi({ example: 'USD Coin' }),
  contract_address: z.string().nullable().openapi({ example: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }),
  network_id: z.string().openapi({ example: 'ethereum' }),
  balance: z.string().optional().openapi({ example: '1000000000000000000' }),
}).openapi('Token')

// Query params schema
export const TokensQuerySchema = z.object({
  network_id: z.string().optional().openapi({ description: 'Filter tokens by network ID', example: 'ethereum' }),
  search: z.string().optional().openapi({ description: 'Search tokens by address, symbol, or name', example: 'usdc' }),
  wallet: z.string().optional().openapi({ description: 'Filter to tokens with non-zero balances for this wallet', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2' }),
  page: z.coerce.number().default(1).openapi({ description: 'Page number', example: 1 }),
  limit: z.coerce.number().default(50).openapi({ description: 'Items per page', example: 50 }),
}).openapi('TokensQuery')

// Response schemas
export const TokensResponseSchema = z.object({
  tokens: z.array(TokenSchema),
  total: z.number().openapi({ example: 100 }),
}).openapi('TokensResponse')

export const NetworksResponseSchema = z.array(NetworkSchema).openapi('NetworksResponse')

// Register paths
registry.registerPath({
  method: 'get',
  path: '/networks',
  summary: 'List supported networks',
  responses: {
    200: {
      description: 'List of supported networks',
      content: {
        'application/json': {
          schema: NetworksResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/tokens',
  summary: 'List tokens',
  description: 'Returns tokens filtered by network, search term, or wallet address',
  request: {
    query: TokensQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of tokens',
      content: {
        'application/json': {
          schema: TokensResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
    },
  },
})

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Asset Registry API',
      version: '1.0.0',
      description: 'API for crypto networks and token assets',
    },
    servers: [{ url: 'http://localhost:3000' }],
  })
}
