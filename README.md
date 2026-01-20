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

### State Management

Omitted - React Query handles server state caching; no complex client state needed.

### Server-Side Caching

Omitted for now. At scale, Redis would cache common responses.

### Rate Limiting

In-memory rate limiting (express-rate-limit) works for single instances. For horizontal scaling with multiple replicas, use Redis store (`rate-limit-redis`) for shared state.

### Logging

Uses built-in `console.*` methods with appropriate log levels (`info`, `warn`, `error`). For production, consider structured logging with a library like [pino](https://github.com/pinojs/pino) and centralized log aggregation (Datadog, CloudWatch, etc.) for observability.

### Package Manager

npm - avoiding unnecessary complexity.
