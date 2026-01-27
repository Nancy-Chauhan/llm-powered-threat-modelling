# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files and tsconfig
COPY package.json bun.lock* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN bun run build

# Build backend
WORKDIR /app/backend
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy package files for production (all workspaces needed for bun install)
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install production dependencies only
RUN bun install --frozen-lockfile --production --ignore-scripts

# Copy shared package source (needed at runtime)
COPY packages/shared ./packages/shared

# Copy built backend
COPY --from=builder /app/backend/dist ./backend/dist

# Copy built frontend to be served by backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create uploads directory
RUN mkdir -p /app/uploads

WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Health check (using bun fetch since curl/wget may not be available in slim image)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1

# Start the server
CMD ["bun", "run", "dist/index.js"]
