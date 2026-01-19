# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Asset Registry Service - a fullstack TypeScript application that displays cryptocurrency networks, tokens, and wallet balances using CoinGecko API data.

## Commands

```bash
# Development
nix develop              # Enter reproducible dev shell (Node.js 24, PostgreSQL 18)
docker compose up -d     # Start PostgreSQL
npm install              # Install all workspace dependencies
npm run migrate -w @repo/api  # Run database migrations
npm run dev              # Run frontend + backend via Turbo (main dev command)
npm run build            # Build both workspaces
npm run typecheck        # TypeScript checking

# Docker (api only - web deploys to CDN in production)
docker build -f apps/api/Dockerfile -t api .
```

## Architecture

**Monorepo Structure** using npm Workspaces + Turborepo:
- `apps/web/` - React 19 + Vite + Tailwind + React Query
- `apps/api/` - Node.js + Express + Zod + PostgreSQL
- `packages/shared/` - Shared Zod schemas and TypeScript types

**Key Files**:
- `apps/api/src/routes.ts` - REST route definitions
- `apps/api/src/index.ts` - Express server setup
- `apps/api/src/migrate.ts` - Database migration runner
- `apps/api/migrations/` - SQL migration files (001_*.sql, 002_*.sql, etc.)
- `apps/web/src/api.ts` - Typed API client (fetch + types)
- `apps/web/src/main.tsx` - React entry with React Query provider
- `apps/web/src/App.tsx` - Main UI component
- `packages/shared/src/schemas.ts` - Shared Zod schemas

## Tech Decisions

- REST API with Express
- Zod for runtime validation
- React Query for server state management
- PostgreSQL via `pg` (node-postgres) driver (not an ORM)

## Current Status

Infrastructure is complete. See TODO.md for feature implementation roadmap:
- Backend: CoinGecko API integration, PostgreSQL schema, rate limiting
- Frontend: Network/token lists, wallet input, balance display
