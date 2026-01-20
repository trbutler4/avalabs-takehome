import type { Network, Token, TokensQuery, TokensResponse } from "@repo/shared";
// NOTE: Runtime validation adds ~12KB to bundle. Since we control the backend and share
// schemas, this is defensive rather than necessary. Can be removed if bundle size is critical.
import {
	NetworksResponseSchema,
	TokensQuerySchema,
	TokensResponseSchema,
} from "@repo/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type { Network, Token, TokensResponse, TokensQuery };

export async function fetchNetworks(): Promise<Network[]> {
	const res = await fetch(`${API_URL}/networks`);
	if (!res.ok) throw new Error("Failed to fetch networks");
	const data = await res.json();
	return NetworksResponseSchema.parse(data);
}

export async function fetchTokens(query: TokensQuery): Promise<TokensResponse> {
	// Validate query params before sending
	const validatedQuery = TokensQuerySchema.parse(query);

	const params = new URLSearchParams(
		Object.entries(validatedQuery)
			.filter(([, v]) => v != null)
			.map(([k, v]) => [k, String(v)]),
	);

	const res = await fetch(`${API_URL}/tokens?${params}`);
	if (!res.ok) throw new Error("Failed to fetch tokens");
	const data = await res.json();
	return TokensResponseSchema.parse(data);
}

// Fetch all pages of tokens (for wallet queries where we need all data upfront)
export async function fetchAllTokens(
	query: Omit<TokensQuery, "page" | "limit">,
): Promise<Token[]> {
	const limit = 100; // Max allowed by API
	let page = 1;
	let allTokens: Token[] = [];

	while (true) {
		const response = await fetchTokens({ ...query, page, limit });
		allTokens = allTokens.concat(response.tokens);

		if (allTokens.length >= response.total || response.tokens.length < limit) {
			break;
		}
		page++;
	}

	return allTokens;
}
