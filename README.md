# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

> **Monorepo**: Uses [Turborepo](https://turbo.build) for simple monorepo task orchestration.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind
- **Backend**: Node.js, TypeScript, tRPC, Zod
- **Database**: PostgreSQL

> **Note**: I typically prefer protobuf + ConnectRPC for API contracts due to language-agnostic design and explicit schema documentation. Used tRPC here to match the preferred stack and learn the tool.

> **Note**: Using Yarn PnP (Plug'n'Play) with standard `tsc` for typechecking. While `tsgo` is faster, it doesn't support Yarn PnP's module resolution. Chose PnP to try Yarn's modern approach, accepting the tradeoff since tsgo is still in development and not technically ready for production, even though type checking is ready.

## Development

```bash
nix develop     # Enter dev shell (if you don't use nix, try it out!)
yarn install    # Install deps
yarn dev        # Start frontend + backend
```

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:4173
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432
