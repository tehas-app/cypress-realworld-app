#!/bin/sh
# Start the preview: a fresh database from the seed in /data (the root is
# read-only, and /data is in memory and empty at every start), the backend on
# 3001, and the app with the API under /api on 8080.
set -eu
cp data/database-seed.json /data/database.json
node node_modules/.bin/ts-node --transpile-only -P tsconfig.tsnode.json --files backend/app.ts &
exec node node_modules/.bin/ts-node --transpile-only -P tsconfig.tsnode.json scripts/previewServer.ts
