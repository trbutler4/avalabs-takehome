# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

> **Monorepo**: Uses [Turborepo](https://turbo.build) for simple monorepo task orchestration.



## Local Development

```bash
nix develop              # Optional: reproducible dev environment (Node.js 24, PostgreSQL 18)
docker compose up -d     # Start PostgreSQL
npm install
npm run migrate -w @repo/api # Run database migrations
npm run dev              # Start frontend + backend with hot reload
```

## API Design Decision

This service exposes a REST API with an OpenAPI specification. The decision considered three approaches:

1. **tRPC** - Excellent TypeScript-first DX with end-to-end type safety. However, it only benefits TypeScript consumers. Since this service will be consumed by other backend services (for transaction validation) whose tech stack is unknown, tRPC would leave non-TS consumers with an undocumented JSON API.

2. **ConnectRPC + Protobuf** - Provides language-agnostic schema, efficient binary encoding, and built-in streaming. Great for high-throughput service meshes. However, this system doesn't require streaming, and optimizing for binary wire format is premature without concrete performance requirements.

3. **REST + OpenAPI** (chosen) - Universal compatibility. Any service in any language can consume the API using the OpenAPI spec to generate clients. Well-understood patterns, excellent tooling ecosystem, and easy to debug. The right level of complexity for the current requirements.

## Database Access Decision

This service uses `pg-promise` with raw SQL instead of an ORM like Prisma or Drizzle. The schema is simple (2 tables, 1 foreign key) and the queries are straightforward SELECTs and UPSERTs. An ORM would add dependency weight (~15MB for Prisma), require a code generation step in the build, and abstract away queries that are already easy to read. Raw SQL keeps the codebase simple and the Docker image small.

`pg-promise` is the [recommended PostgreSQL driver](https://expressjs.com/en/guide/database-integration.html#postgresql) in the Express documentation. It provides higher-level abstractions over the base `pg` driver—automatic connection pooling, transaction management (`BEGIN`/`COMMIT`/`ROLLBACK`), query formatting, and a promise-based API that eliminates manual connection acquisition and release.

## Package Manger Decision

Which package manager to use is generally very team dependent, and mostly preference based. I just want to avoid any additional complexity here, so simply using npm.

```bash
npm run migrate -w @repo/api # Apply pending migrations
```

## Design System

Often the most difficult part of UI development is maintaining a common brand image, consistent styling and behavior with full accessibility features. The best way to handle this is by working with a proper design system.

This project uses [shadcn/ui](https://ui.shadcn.com) components, which are built on [Radix UI](https://www.radix-ui.com) primitives for accessibility (keyboard navigation, ARIA attributes, focus management) and styled with Tailwind CSS. The components live in `apps/web/src/components/ui/`.

**Note on scaling**: At larger scale with multiple frontend applications, the design system would typically be extracted into a standalone package (`packages/design-system`) with its own build step, Tailwind preset, and component exports. This allows shared components and consistent branding across apps. For brevity in this project, the components are implemented directly within the web app.

## Client State Management

Since we really dont have much client state, and its all server state, i am simply omitting state management, since we have caching for API responses.

## Server-Side Caching

At scale, we would want to use redis or similar to cache common response to serve them immediatley. Omitting here. 

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

