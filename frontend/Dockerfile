ARG SITE_URL="https://telemetriq.app"
FROM oven/bun:alpine AS base

WORKDIR /app

# expose SITE_URL to build/runtime inside image (default)
ENV SITE_URL="https://telemetriq.app"

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Development stage
FROM base AS dev
EXPOSE 5173
ENV NODE_ENV=development
CMD ["bun", "run", "dev", "--host"]

# Build stage
FROM base AS build
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
# Make SITE_URL available to Vite/client code as VITE_SITE_URL during the build
ENV VITE_SITE_URL=${SITE_URL}
RUN bun run build

# Production stage - serve with Caddy
FROM caddy:2.10.2-alpine AS production
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

# Expose standard HTTP port
EXPOSE 80
# Caddy's official image will run and pick up /etc/caddy/Caddyfile by default
# no extra CMD needed
