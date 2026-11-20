#!/bin/sh
# The tag of the deps image for this commit: the first 16 hex digits of the
# SHA-256 of what decides node_modules: the lockfile, the patches, .yarnrc
# and the deps image's own recipe. A dependency change changes yarn.lock.
set -eu
cd "$(dirname "$0")/.."
cat preview/deps.Dockerfile yarn.lock .yarnrc patches/* | sha256sum | cut -c1-16
