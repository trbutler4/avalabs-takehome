import type { Network, Token, TokensResponse, TokensQuery } from '@repo/shared'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type { Network, Token, TokensResponse, TokensQuery }

export async function fetchNetworks(): Promise<Network[]> {
  const res = await fetch(`${API_URL}/networks`)
  if (!res.ok) throw new Error('Failed to fetch networks')
  return res.json()
}

export async function fetchTokens(query: TokensQuery): Promise<TokensResponse> {
  const params = new URLSearchParams()
  if (query.network_id) params.set('network_id', query.network_id)
  if (query.search) params.set('search', query.search)
  if (query.wallet) params.set('wallet', query.wallet)
  if (query.page) params.set('page', query.page.toString())
  if (query.limit) params.set('limit', query.limit.toString())

  const res = await fetch(`${API_URL}/tokens?${params}`)
  if (!res.ok) throw new Error('Failed to fetch tokens')
  return res.json()
}
