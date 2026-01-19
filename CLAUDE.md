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
npm run migrate -w backend  # Run database migrations
npm run dev              # Run frontend + backend via Turbo (main dev command)
npm run build            # Build both workspaces
npm run typecheck        # TypeScript checking

# Docker (backend only - frontend deploys to CDN in production)
docker build -f backend/Dockerfile -t backend .
```

## Architecture

**Monorepo Structure** using npm Workspaces + Turborepo:
- `frontend/` - React 19 + Vite + Tailwind + React Query
- `backend/` - Node.js + Express + Zod + PostgreSQL

**Key Files**:
- `backend/src/routes.ts` - REST route definitions
- `backend/src/index.ts` - Express server setup
- `backend/src/migrate.ts` - Database migration runner
- `backend/migrations/` - SQL migration files (001_*.sql, 002_*.sql, etc.)
- `frontend/src/api.ts` - Typed API client (fetch + types)
- `frontend/src/main.tsx` - React entry with React Query provider
- `frontend/src/App.tsx` - Main UI component

## Tech Decisions

- REST API with Express
- Zod for runtime validation
- React Query for server state management
- PostgreSQL via `pg` (node-postgres) driver (not an ORM)

## Current Status

Infrastructure is complete. See TODO.md for feature implementation roadmap:
- Backend: CoinGecko API integration, PostgreSQL schema, rate limiting
- Frontend: Network/token lists, wallet input, balance display
