FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Development: hot reload, source is bind-mounted -----------------------
FROM deps AS dev
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Production build --------------------------------------------------------
FROM deps AS builder
COPY . .
ARG NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=30
ENV NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=$NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 PORT=3000
CMD ["node", "server.js"]
