#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages build entrypoint.
# Dependency installation is intentionally explicit so the project does not
# depend on Cloudflare's automatic package-manager detection.
npm install --no-audit --no-fund
npm run build
