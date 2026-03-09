#!/bin/bash
set -e

# Ensure the local-types directory has a minimal package.json so bun link
# can register it, even if neems-api hasn't generated types yet.
if [ ! -f /local-types/package.json ]; then
  cat > /local-types/package.json << 'EOF'
{
  "name": "@newtown-energy/types",
  "version": "0.0.0-local",
  "types": "./index.ts",
  "exports": { ".": "./index.ts" }
}
EOF
  echo "Created placeholder package.json in /local-types"
fi

# Register local-types as a globally linked package, then link it into
# this project's node_modules. This creates a symlink at
# node_modules/@newtown-energy/types -> /local-types.
# When neems-api generates real types, they appear through the symlink.
cd /local-types && bun link
cd /app && bun link @newtown-energy/types

# Start the dev server
exec bun run dev
