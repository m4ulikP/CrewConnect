# ==============================================================================
# CrewConnect Web - Production Multi-Stage Dockerfile (Vite + NGINX)
# ==============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy source code and build configs
COPY packages/shared/src ./packages/shared/src
COPY apps/web ./apps/web

# Build shared package and production web bundle
RUN npm run build:shared && npm run build --workspace=@crewconnect/web

# --- Stage 2: NGINX Static Web Server ---
FROM nginx:1.25-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
