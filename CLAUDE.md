# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Asset Registry Service - a fullstack TypeScript application that displays cryptocurrency networks, tokens, and wallet balances using CoinGecko API data.

## Commands

```bash
# Development
nix develop              # Enter reproducible dev shell (Node.js 22, PostgreSQL 16)
yarn install             # Install all workspace dependencies
yarn dev                 # Run frontend + backend concurrently (main dev command)
yarn build               # Build both workspaces
yarn typecheck           # TypeScript checking across all workspaces

# Individual workspaces
yarn workspace frontend dev      # Vite dev server only
yarn workspace backend dev       # Backend with tsx watch only

# Docker
docker compose up --build        # Full stack: frontend:4173, backend:3000, postgres:5432
```

## Architecture

**Monorepo Structure** using Yarn Workspaces:
- `frontend/` - React 19 + Vite + Tailwind + tRPC client
- `backend/` - Node.js + tRPC server + Zod validation + PostgreSQL

**tRPC Integration**: The frontend imports `AppRouter` type from backend for end-to-end type safety. Client setup in `frontend/src/trpc.ts`, router definition in `backend/src/router.ts`.

**Key Files**:
- `backend/src/router.ts` - tRPC procedure definitions (API endpoints)
- `backend/src/index.ts` - HTTP server setup with CORS
- `frontend/src/main.tsx` - React entry with tRPC/React Query providers
- `frontend/src/App.tsx` - Main UI component

## Tech Decisions

- tRPC 11 RC for type-safe APIs (author notes preference for protobuf+ConnectRPC in production)
- Zod for runtime validation on backend
- React Query via tRPC integration for server state
- PostgreSQL via `postgres` driver (not an ORM)

## Current Status

Infrastructure is complete. See TODO.md for feature implementation roadmap:
- Backend: CoinGecko API integration, PostgreSQL schema, rate limiting
- Frontend: Network/token lists, wallet input, balance display
