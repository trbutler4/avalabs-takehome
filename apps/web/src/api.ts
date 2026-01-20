import type { Network, Token, TokensQuery, TokensResponse } from "@repo/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type { Network, Token, TokensResponse, TokensQuery };

export async function fetchNetworks(): Promise<Network[]> {
	const res = await fetch(`${API_URL}/networks`);
	if (!res.ok) throw new Error("Failed to fetch networks");
	return res.json();
}

export async function fetchTokens(query: TokensQuery): Promise<TokensResponse> {
	const params = new URLSearchParams(
		Object.entries(query)
			.filter(([, v]) => v != null)
			.map(([k, v]) => [k, String(v)]),
	);

	const res = await fetch(`${API_URL}/tokens?${params}`);
	if (!res.ok) throw new Error("Failed to fetch tokens");
	return res.json();
}
