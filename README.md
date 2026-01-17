# Ava Labs Fullstack Takehome

Full-stack app with React frontend and Node.js backend.

## Stack

- **Frontend**: React, TypeScript, Vite, Tailwind, shadcn/ui
- **Backend**: Node.js, TypeScript, tRPC, Zod
- **Database**: PostgreSQL

> **Note**: I typically prefer protobuf + ConnectRPC for API contracts due to language-agnostic design and explicit schema documentation. Used tRPC here to match the preferred stack and learn the tool.

## Development

```bash
nix develop     # Enter dev shell
yarn install    # Install deps
yarn dev        # Start frontend + backend
```

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432
