# ============================================================
# Stage 1: Build the frontend (Vite + React)
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy dependency manifests
COPY frontend/package.json frontend/package-lock.json ./

# Install ALL dependencies (including devDependencies for vite/tsc)
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build the static assets
RUN npm run build

# ============================================================
# Stage 2: Build the backend (TypeScript → JavaScript)
# ============================================================
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy dependency manifests
COPY server/package.json server/package-lock.json ./

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci

# Copy TypeScript source
COPY server/tsconfig.json ./
COPY server/src ./src

# Compile TypeScript → JavaScript
RUN npm run build

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production dependencies only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from the server builder
COPY --from=server-builder /app/dist ./dist

# Copy built frontend assets alongside the server
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the default API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run the server
CMD ["node", "dist/index.js"]