import { z } from "zod";

// Network schema
export const NetworkSchema = z.object({
	id: z.string(),
	chain_id: z.number(),
	name: z.string(),
	native_coin_id: z.string(),
});

// Token schema
export const TokenSchema = z.object({
	id: z.string(),
	symbol: z.string(),
	name: z.string(),
	contract_address: z.string().nullable(),
	network_id: z.string(),
	balance: z.string().optional(),
	decimals: z.number().optional(),
});

// Query params schema
export const TokensQuerySchema = z.object({
	network_id: z.string().optional(),
	search: z.string().max(100).optional(),
	wallet: z.string().optional(),
	page: z.coerce.number().min(1).default(1),
	limit: z.coerce.number().min(1).max(100).default(50),
});

// Response schemas
export const TokensResponseSchema = z.object({
	tokens: z.array(TokenSchema),
	total: z.number(),
});

export const NetworksResponseSchema = z.array(NetworkSchema);

// Inferred types for convenience
export type Network = z.infer<typeof NetworkSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type TokensQuery = z.infer<typeof TokensQuerySchema>;
export type TokensResponse = z.infer<typeof TokensResponseSchema>;
