# The preview's dependencies, published as
# ghcr.io/tehas-app/cypress-realworld-app-deps:<tag> by
# .github/workflows/preview-deps.yml. A preview's build has no network, so
# preview/Dockerfile starts FROM this image; <tag> is preview/deps-tag.sh's,
# a digest of what decides node_modules.
FROM node:22.20.0-bookworm-slim
LABEL org.opencontainers.image.source=https://github.com/tehas-app/cypress-realworld-app
WORKDIR /app
COPY package.json yarn.lock .yarnrc ./
COPY patches ./patches
RUN HUSKY=0 CYPRESS_INSTALL_BINARY=0 yarn install --frozen-lockfile --network-timeout 500000 \
 && yarn cache clean
