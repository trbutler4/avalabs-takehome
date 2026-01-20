# Ava Labs Fullstack Takehome

Full-stack asset registry with React frontend and Node.js backend.

## Local Development

```bash
nix develop                     # Optional: reproducible dev environment
docker compose up -d            # Start PostgreSQL
npm install
cp apps/api/.env.example apps/api/.env  # Configure environment
npm run migrate:up -w @repo/api
npm run dev
```

### Migrations

```bash
npm run -w @repo/api migrate:up              # Apply migrations
npm run -w @repo/api migrate:down            # Rollback
npm run -w @repo/api migrate:create -- name  # Create new
```

## Production

Deployed on Digital Ocean App Platform with managed PostgreSQL.

[Live App](https://avalabs-api-qt6t7.ondigitalocean.app/)

## Design Decisions

**REST + OpenAPI** - Chose REST over tRPC/ConnectRPC for universal compatibility.

**pg-promise with raw SQL** - Simple 2-table schema doesn't need an ORM. Keeps the Docker image small.

**Network Support** - Only sync networks from CoinGecko that have Alchemy RPC support. To add a network, update `apps/api/src/alchemy.ts`.

**Token Query Parameters** - I interpreted the spec's separate query param examples as combinable (e.g., `/tokens?wallet=0x...&search=eth&network_id=ethereum`).

**Client-Side Filtering for Wallet Tokens** - The client fetches all pages upfront and filters locally. Wallet queries require ~26 Alchemy RPC calls regardless of search terms, so caching everything makes subsequent searches instant.

**Rate Limiting** - In-memory with express-rate-limit. Would need Redis for horizontal scaling.

**Omitted** - Auth, server-side caching, client state management (React Query is mostly sufficient, including some state in URL params would probably actually be enough).

## Future Work (due to time constraints)

- **Background Token Sync** - Currently only syncs on startup when DB is empty. Would add periodic sync, token images, and market data.
- **Testing** - No tests. Would add Jest, Supertest, Playwright.
- **Observability** - No error tracking (Sentry), APM, or metrics.
- **Caching** - Redis for API responses.
- **UI Polish** - Typography, animations, skeletons. Automatic ENS detection on wallet input. Maybe a seperate portfolio page.
- **API Docs** - Swagger UI for `/openapi.json`.
