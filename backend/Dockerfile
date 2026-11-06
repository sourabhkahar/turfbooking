# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# uploads is a named volume mounted at runtime
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000
ENV NODE_ENV=production

CMD ["node", "index.js"]

