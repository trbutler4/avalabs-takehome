# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

> **Monorepo**: Uses [Turborepo](https://turbo.build) for simple monorepo task orchestration.

## Local Development

```bash
nix develop                     # Optional: reproducible dev environment (Node.js 24, PostgreSQL 18)
docker compose up -d            # Start PostgreSQL
npm install                     # Install deps
cp apps/api/.env.example apps/api/.env  # Configure environment variables
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/avalabs
npm run migrate:up -w @repo/api # Run database migrations
npm run dev                     # Start frontend + backend with hot reload
```

### Migrations

Migrations use [node-pg-migrate](https://github.com/salsita/node-pg-migrate). `DATABASE_URL` must be set.

```bash
npm run -w @repo/api migrate:up              # Apply pending migrations
npm run -w @repo/api migrate:down            # Rollback last migration
npm run -w @repo/api migrate:create -- name  # Create new migration
```

## Production Deployment

**API**: Dockerized for container orchestration (ECS, Cloud Run, Kubernetes)
```bash
docker build -f apps/api/Dockerfile -t api .
```

**Web**: Static build deployed to CDN (Vercel, Cloudflare Pages, S3+CloudFront)
```bash
npm run build -w @repo/web
# Deploy apps/web/dist to CDN
```

**Database**: Use a managed PostgreSQL service (RDS, Cloud SQL, etc.)

## Design Decisions

### API: REST + OpenAPI

Chose REST over tRPC (TS-only consumers) and ConnectRPC (premature optimization for this use case). REST provides universal compatibility - any language can consume the API via the OpenAPI spec.

### Database: pg-promise with raw SQL

Simple schema (2 tables) doesn't need an ORM. `pg-promise` is the [Express-recommended driver](https://expressjs.com/en/guide/database-integration.html#postgresql), provides connection pooling and transaction management, and keeps the Docker image small.

### UI: shadcn/ui + Radix

[shadcn/ui](https://ui.shadcn.com) components built on [Radix UI](https://www.radix-ui.com) primitives for accessibility. At scale, these would be extracted to a shared `packages/design-system`.

### Network Support

Only syncs networks from CoinGecko that have RPC support configured (via Alchemy). Wallet balance queries require RPC access, and limiting to supported networks keeps the database lean. To add a network, update `apps/api/src/alchemy.ts`.

### Token Query Parameters

The spec lists separate endpoints (`/tokens?network_id=`, `/tokens?search=`, `/tokens?wallet=`). I interpreted this as query parameters that can be combined in a single request (e.g., `/tokens?wallet=0x...&search=eth&network_id=ethereum`) rather than mutually exclusive endpoints.

### Client-Side Filtering for Wallet Tokens

When a wallet address is provided, the client fetches all pages of tokens upfront and caches them with React Query. Filtering and pagination then happen client-side.

Rationale: Wallet queries require Alchemy RPC calls (~16 per request across all networks) regardless of search terms or pagination. Fetching all pages upfront and caching means subsequent searches are instant instead of triggering redundant RPC calls. The API remains consistently paginated per the spec.

### CLient Side State Management

Omitted - React Query handles server state caching; no complex client state is really needed. Inlcuding the query params in the URL would probably be sufficient.

### Auth

Omitted - out of scope here. We would want some auth strategy, probably with user login on the client and api keys for other consumers.

### Server-Side Caching

Omitted for now. At scale, Redis would cache common responses.

### Rate Limiting

In-memory rate limiting (express-rate-limit) works for single instances. For horizontal scaling with multiple replicas, use Redis store (`rate-limit-redis`) for shared state.

### Logging

Uses built-in `console.*` methods with appropriate log levels (`info`, `warn`, `error`). For production, consider structured logging with a library like [pino](https://github.com/pinojs/pino) and centralized log aggregation (Datadog, CloudWatch, etc.) for observability.

### Package Manager

npm - avoiding unnecessary complexity.

## Future Work

The following items are not addressed in this implementation due to time constraints:

- **Background Token Sync** - Network and token metadata is only synced from CoinGecko on initial startup (when the database is empty). A production system should implement:
  - Periodic sync via background worker (e.g., cron job or `setInterval`) to pick up new tokens and networks
  - Token images/logos via `/coins/{id}` endpoint
  - Market data (prices, market cap, 24h change) via `/coins/markets` or `/simple/price` endpoints
  - The existing advisory lock mechanism (`pg_try_advisory_lock`) already prevents concurrent syncs across multiple instances
- **Testing** - No unit, integration, or E2E tests. Consider Jest for unit tests, Supertest for API integration tests, and Playwright/Cypress for E2E.
- **Error Tracking** - No Sentry or DataDog integration for capturing and alerting on production errors.
- **APM/Metrics** - No Prometheus, StatsD, or similar for application performance monitoring and metrics collection.
- **Caching Layer** - Redis for caching common API responses and reducing database load.
- **Production Runbook** - Documentation for deployment procedures, scaling strategies, and disaster recovery.
