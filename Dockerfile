# SakBol — production image (Next.js 15 + Prisma)
# Build: docker compose -f docker-compose.selfhosted.yml build
# Requires SKIP_PRISMA_MIGRATE_ON_BUILD=1 during image build (no DB in build context).

FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_PRISMA_MIGRATE_ON_BUILD=1

RUN npx prisma generate && npm run build

# --- runtime ---

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# `npm ci` runs postinstall → prisma generate; schema must exist first
COPY --from=builder /app/prisma ./prisma
RUN npm ci --omit=dev && npm install prisma@5.22.0 --no-save

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/entrypoint.sh"]
