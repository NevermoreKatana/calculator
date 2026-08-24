# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Ganache Calculator — multi-stage image.
#
# Stages:
#   base    node + the native libs Prisma's query engine needs
#   deps    npm ci (including devDependencies — the build needs them)
#   builder next build → .next/standalone ; also the image used for migrations
#   runner  lean runtime: standalone server only, non-root
#
# The Vercel deployment path is unaffected: this container is for running the
# app locally, not a requirement of the hosted deploy.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
# openssl is required by the Prisma query engine; libc6-compat covers glibc
# shims some prebuilt binaries expect on musl.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
# The schema is copied before `npm ci` because the `postinstall` hook runs
# `prisma generate`, which needs it.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci


# ── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate against the schema in this stage so the client always matches.
RUN npx prisma generate
# A dummy URL satisfies Prisma's client construction during the build. Every
# page is force-dynamic, so no route actually queries the database here.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    DIRECT_DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npm run build


# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next's output tracing can miss Prisma's generated engine binary; copying the
# generated client explicitly guarantees it is present at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

# Reports unhealthy while the app cannot serve, so compose can gate on it.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/calculator').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
