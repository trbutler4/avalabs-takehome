# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

> **Monorepo**: Uses [Turborepo](https://turbo.build) for simple monorepo task orchestration.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind
- **Backend**: Node.js, TypeScript, Express, Zod, OpenAPI
- **Database**: PostgreSQL

## API Design Decision

This service exposes a REST API with an OpenAPI specification. The decision considered three approaches:

1. **tRPC** - Excellent TypeScript-first DX with end-to-end type safety. However, it only benefits TypeScript consumers. Since this service will be consumed by other backend services (for transaction validation) whose tech stack is unknown, tRPC would leave non-TS consumers with an undocumented JSON API.

2. **ConnectRPC + Protobuf** - Provides language-agnostic schema, efficient binary encoding, and built-in streaming. Great for high-throughput service meshes. However, this system doesn't require streaming, and optimizing for binary wire format is premature without concrete performance requirements.

3. **REST + OpenAPI** (chosen) - Universal compatibility. Any service in any language can consume the API using the OpenAPI spec to generate clients. Well-understood patterns, excellent tooling ecosystem, and easy to debug. The right level of complexity for the current requirements.

## Database Access Decision

This service uses the `pg` driver directly with raw SQL instead of an ORM like Prisma or Drizzle. The schema is simple (2 tables, 1 foreign key) and the queries are straightforward SELECTs and UPSERTs. An ORM would add dependency weight (~15MB for Prisma), require a code generation step in the build, and abstract away queries that are already easy to read. Raw SQL keeps the codebase simple and the Docker image small.

## Package Manger Decision

Which package manager to use is generally very team dependent, and mostly preference based. I just want to avoid any additional complexity here, so simply using npm. 

## Local Development

```bash
nix develop              # Optional: reproducible dev environment (Node.js 24, PostgreSQL 18)
docker compose up -d     # Start PostgreSQL
npm install
npm run migrate -w backend   # Run database migrations
npm run dev              # Start frontend + backend with hot reload
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432

## Database Migrations

Migrations live in `backend/migrations/` as sequential SQL files (`001_*.sql`, `002_*.sql`, etc.).

```bash
npm run migrate -w backend   # Apply pending migrations
```

Migrations are tracked in a `schema_migrations` table and run transactionally. Each migration runs exactly once.

## Production Deployment

**Backend**: Dockerized for container orchestration (ECS, Cloud Run, Kubernetes)
```bash
docker build -f backend/Dockerfile -t backend .
```

**Frontend**: Static build deployed to CDN (Vercel, Cloudflare Pages, S3+CloudFront)
```bash
npm run build -w frontend
# Deploy frontend/dist to CDN
```

**Database**: Use a managed PostgreSQL service (RDS, Cloud SQL, etc.)
