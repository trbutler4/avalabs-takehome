FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files and workspace package.jsons for dependency resolution
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace dependencies (needed for shared package build)
RUN npm ci

# Copy shared package source and build it first
COPY packages/shared/ ./packages/shared/
RUN npm run build -w @repo/shared

# Copy api source and build
COPY apps/api/ ./apps/api/
RUN npm run build -w @repo/api

# Production stage
FROM node:24-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy CA certificate for database SSL verification
COPY apps/api/certs ./apps/api/certs

WORKDIR /app/apps/api

# Switch to non-root user
USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]
