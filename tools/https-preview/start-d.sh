#!/bin/sh
# Like start.sh, but keeps the container running in the background after the terminal closes.
#   start-d.sh              build and start in the background
#   start-d.sh --no-build   start only (dist/ is already current)
# View logs: docker compose -f tools/https-preview/docker-compose.yaml logs -f
# Stop:      tools/https-preview/stop.sh

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

prepare_preview "$@"
compose up -d
print_address
echo "Stop with: ${SCRIPT_DIR}/stop.sh"
