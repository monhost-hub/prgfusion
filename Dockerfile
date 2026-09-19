# ============================================================================
# AllCombiner — Dockerfile (for VPS / Cloud / Container deployment)
# ============================================================================
# Build:
#   docker build -t allcombiner:latest .
#
# Run:
#   docker run -d --name allcombiner \
#     -p 3000:3000 \
#     -e NEXT_PUBLIC_APP_URL=https://www.allcombiner.com \
#     -e AUTH_SECRET=$(openssl rand -base64 32) \
#     -e OPENROUTER_API_KEY=sk-or-v1-... \
#     -e ADMIN_EMAIL=admin@allcombiner.com \
#     -e ADMIN_PASSWORD=... \
#     -v $(pwd)/data:/app/data \
#     --restart unless-stopped \
#     allcombiner:latest
# ============================================================================

# --- Stage 1: deps ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma
RUN npm ci || npm install
RUN npx prisma generate

# --- Stage 2: builder ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# --- Stage 3: runner ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone build (Next.js output: "standalone")
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Create data dir for SQLite (if used)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

# Create logs dir
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run migrations on startup, then start the server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]
