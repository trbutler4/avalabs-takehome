# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

> **Monorepo**: Uses [Turborepo](https://turbo.build) for simple monorepo task orchestration.

## Local Development

```bash
nix develop                     # Optional: reproducible dev environment (Node.js 24, PostgreSQL 18)
docker compose up -d            # Start PostgreSQL
npm install                     # Install deps
npm run migrate -w @repo/api    # Run database migrations (only needs to be done once)
npm run dev                     # Start frontend + backend with hot reload
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

### Package Manager

npm - avoiding unnecessary complexity.
