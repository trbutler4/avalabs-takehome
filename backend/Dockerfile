FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files and workspace package.jsons for dependency resolution
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install backend workspace dependencies
RUN npm ci --workspace=backend

# Copy backend source
COPY backend/ ./backend/

# Build
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm ci --workspace=backend --omit=dev

COPY --from=builder /app/backend/dist ./backend/dist

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "dist/index.js"]
