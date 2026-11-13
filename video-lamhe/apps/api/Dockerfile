# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile -t video-lamhe-api .
# Run:                       docker run --env-file .env -p 4000:4000 video-lamhe-api

ARG NODE_VERSION=22-alpine

# ---- deps: full install (dev deps needed for tsup) ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN if [ -f package-lock.json ]; then npm ci -w @video-lamhe/api --include-workspace-root=false; \
    else npm install -w @video-lamhe/api --include-workspace-root=false; fi

# ---- build: tsup bundles src + packages/shared into dist/ ----
FROM deps AS build
COPY tsconfig*.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @video-lamhe/api

# ---- prod-deps: runtime dependencies only ----
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN if [ -f package-lock.json ]; then npm ci --omit=dev -w @video-lamhe/api --include-workspace-root=false; \
    else npm install --omit=dev -w @video-lamhe/api --include-workspace-root=false; fi \
 && npm cache clean --force

# ---- runtime ----
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /repo
# Keep the workspace layout so hoisted (/repo/node_modules) and non-hoisted (apps/api/node_modules) deps both resolve.
COPY --from=prod-deps --chown=node:node /repo ./
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
