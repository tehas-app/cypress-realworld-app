# The preview (tehas: a pull request's preview at uat-<pr>-demo.tehas.app).
# It has no network at build, so the dependencies come from the deps image;
# its tag must be preview/deps-tag.sh's, which CI checks
# (.github/workflows/preview-deps.yml) and which that workflow publishes.
# The root is read-only: the database is in /data, made fresh at each start.
FROM ghcr.io/tehas-app/cypress-realworld-app-deps:e32a5d4d1718732d
WORKDIR /app
COPY . .
RUN cp scripts/mock-aws-exports.js src/aws-exports.js \
 && VITE_API_URL=/api yarn build \
 && ln -sf /data/database.json data/database.json \
 && rm -rf node_modules/.cache
# Two node processes in 256 MB: each heap is capped well under half.
ENV NODE_ENV=development VITE_BACKEND_PORT=3001 PORT=8080 PREVIEW_PORT=8080 \
    NODE_OPTIONS=--max-old-space-size=96
EXPOSE 8080
CMD ["sh", "preview/start.sh"]
