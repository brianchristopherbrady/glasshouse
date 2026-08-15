#!/usr/bin/env bash
# Thin convenience wrapper. The real validator lives at scripts/validate-world.ts.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
npm run validate:world
