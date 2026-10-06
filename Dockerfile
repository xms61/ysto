# The game's image (docs/design-docs/hosting-and-deploy.md). The client build and the production dependencies
# are made on the build platform, since neither depends on the CPU; the runtime stage adds ffmpeg for the target.
# Dependabot keeps the digest current.
ARG NODE_IMAGE=node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html vite.config.ts tsconfig.json ./
COPY public public
COPY shared shared
COPY src src
RUN npm run build

FROM ${NODE_IMAGE}
# The server needs no package manager, and the ones in the base image carry their own vulnerabilities.
RUN apk add --no-cache ffmpeg tini  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-*     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production \
    YSTO_AUDIO_DIR=/data/audio \
    YSTO_CATALOG_DIR=/data/catalog \
    YSTO_STATE_DIR=/data/state
# The state volume's mount point, owned by node, so a new named volume starts out writable for the server.
RUN mkdir -p /data/state && chown node:node /data/state
COPY package.json ./
COPY --from=deps /app/node_modules node_modules
COPY server server
COPY shared shared
# The clip benchmark, so the host's clip timing can be measured in the image that serves the game.
COPY scripts/clips/bench.ts scripts/clips/
COPY scripts/catalog/cli.ts scripts/catalog/
# The owner's list of clip reports, run in the image that keeps them.
COPY scripts/clip-reports scripts/clip-reports
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/main.ts"]
