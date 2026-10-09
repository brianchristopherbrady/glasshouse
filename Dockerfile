# syntax=docker/dockerfile:1

# ---- build: compile every workspace and produce the server bundle + web UI
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/parser/package.json packages/parser/
COPY packages/telemetry-client/package.json packages/telemetry-client/
RUN npm ci
COPY . .
RUN npx prisma generate --schema apps/server/prisma/schema.prisma && REQUIRE_WEB_DIST=true npm run build

# ---- deps: production-only dependencies for the server, from the lockfile
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/parser/package.json packages/parser/
COPY packages/telemetry-client/package.json packages/telemetry-client/
RUN npm ci --omit=dev --workspace apps/server && npm cache clean --force

# ---- runtime
FROM node:22-bookworm-slim AS runtime
# openssl: Prisma engines; git + ca-certificates: cloning repos for discovery
RUN apt-get update && apt-get install -y --no-install-recommends openssl git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=4000 \
    AGENTIC_FLOWS_DATA_DIR=/data
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/bin ./apps/server/bin
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/dist/bundle.mjs /app/apps/server/dist/bundle.mjs.map ./apps/server/dist/
COPY --from=build /app/apps/server/dist/web ./apps/server/dist/web
# Pre-generate the PostgreSQL client (the docker-compose deployment) as root.
# This also fetches Prisma's engines into node_modules/prisma, which the
# non-root runtime user cannot write. If another provider is configured (e.g.
# the SQLite default), the CLI regenerates into the node-owned client dir.
RUN DATABASE_URL=postgresql://build-placeholder/db node apps/server/bin/glasshouse.mjs generate \
  && mkdir -p /data \
  && chown -R node:node /data node_modules/.prisma node_modules/@prisma/client
USER node
VOLUME ["/data"]
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "apps/server/bin/glasshouse.mjs"]
CMD ["start"]
