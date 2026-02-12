FROM node:25-alpine AS base

RUN npm install -g bun

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Development stage
FROM base AS dev
EXPOSE 5173
CMD ["bun", "run", "dev", "--host"]

# Build stage
FROM base AS build
RUN bun run build

# Production stage - serve with Caddy
FROM caddy:2.10.2-alpine AS production
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

# Expose standard HTTP port
EXPOSE 80
# Caddy's official image will run and pick up /etc/caddy/Caddyfile by default
# no extra CMD needed
