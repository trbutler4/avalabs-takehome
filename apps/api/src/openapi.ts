import {
	extendZodWithOpenApi,
	OpenAPIRegistry,
	OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import {
	NetworkSchema as BaseNetworkSchema,
	TokenSchema as BaseTokenSchema,
	TokensQuerySchema,
} from "@repo/shared";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Re-export base schema for route validation
export { TokensQuerySchema };

// OpenAPI-extended version for documentation
const OpenAPITokensQuerySchema = z.object({
	network_id: z.string().optional().openapi({ example: "ethereum" }),
	search: z.string().max(100).optional().openapi({ example: "usdc" }),
	wallet: z
		.string()
		.optional()
		.openapi({ example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }),
	page: z.coerce.number().min(1).default(1).openapi({ example: 1 }),
	limit: z.coerce.number().min(1).max(100).default(50).openapi({ example: 50 }),
});

// Extend base schemas with OpenAPI metadata
export const NetworkSchema = BaseNetworkSchema.extend({
	id: z.string().openapi({ example: "ethereum" }),
	chain_id: z.number().openapi({ example: 1 }),
	name: z.string().openapi({ example: "Ethereum" }),
	native_coin_id: z.string().openapi({ example: "ethereum" }),
}).openapi("Network");

export const TokenSchema = BaseTokenSchema.extend({
	id: z.string().openapi({ example: "usd-coin" }),
	symbol: z.string().openapi({ example: "USDC" }),
	name: z.string().openapi({ example: "USD Coin" }),
	contract_address: z
		.string()
		.nullable()
		.openapi({ example: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }),
	network_id: z.string().openapi({ example: "ethereum" }),
	balance: z.string().optional().openapi({ example: "1000000000000000000" }),
	decimals: z.number().optional().openapi({ example: 18 }),
}).openapi("Token");

export const TokensResponseSchema = z
	.object({
		tokens: z.array(TokenSchema),
		total: z.number().openapi({ example: 100 }),
	})
	.openapi("TokensResponse");

export const NetworksResponseSchema = z
	.array(NetworkSchema)
	.openapi("NetworksResponse");

// Register paths
registry.registerPath({
	method: "get",
	path: "/networks",
	summary: "List supported networks",
	responses: {
		200: {
			description: "List of supported networks",
			content: {
				"application/json": {
					schema: NetworksResponseSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "get",
	path: "/tokens",
	summary: "List tokens",
	description:
		"Returns tokens filtered by network, search term, or wallet address",
	request: {
		query: OpenAPITokensQuerySchema,
	},
	responses: {
		200: {
			description: "Paginated list of tokens",
			content: {
				"application/json": {
					schema: TokensResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid query parameters",
		},
	},
});

export function generateOpenAPIDocument() {
	const generator = new OpenApiGeneratorV3(registry.definitions);
	return generator.generateDocument({
		openapi: "3.0.0",
		info: {
			title: "Asset Registry API",
			version: "1.0.0",
			description: "API for crypto networks and token assets",
		},
		servers: [{ url: process.env.API_URL || "http://localhost:3000" }],
	});
}
