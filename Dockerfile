# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (ci for deterministic installs)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build client (Vite → dist/public) and server (esbuild → dist/index.cjs)
RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# The build bundles all required server dependencies into dist/index.cjs,
# so no node_modules are needed at runtime.
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
