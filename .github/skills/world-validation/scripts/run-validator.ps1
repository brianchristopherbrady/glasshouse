# Thin convenience wrapper. The real validator lives at scripts/validate-world.ts.
$ErrorActionPreference = "Stop"
$root = (git rev-parse --show-toplevel 2>$null)
if ($root) { Set-Location $root }
npm run validate:world
