# syntax=docker/dockerfile:1
# Build from the repo root. NEXT_PUBLIC_* values are baked into the JS bundle at BUILD time:
#   docker build -f apps/web/Dockerfile -t video-lamhe-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.videolamhe.pk/api/v1 \
#     --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.videolamhe.pk \
#     --build-arg NEXT_PUBLIC_ADMIN_WHATSAPP=923462590643 .
# Run:  docker run -p 3000:3000 -e INTERNAL_API_URL=http://api:4000/api/v1 video-lamhe-web

ARG NODE_VERSION=22-alpine

# ---- deps ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN if [ -f package-lock.json ]; then npm ci -w @video-lamhe/web --include-workspace-root=false; \
    else npm install -w @video-lamhe/web --include-workspace-root=false; fi

# ---- build (standalone output) ----
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
ARG NEXT_PUBLIC_ADMIN_WHATSAPP=923462590643
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_ADMIN_WHATSAPP=$NEXT_PUBLIC_ADMIN_WHATSAPP \
    NEXT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY tsconfig*.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @video-lamhe/web

# ---- runtime ----
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone keeps the monorepo layout: server.js lives at apps/web/server.js.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
