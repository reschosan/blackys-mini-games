#!/bin/sh
# Builds and serves the game over HTTPS on the local network so real phones can use the camera.
# Runs from any directory with ./start.sh, sh start.sh, zsh start.sh, or bash start.sh.
#   start.sh              build and start in the foreground
#   start.sh --no-build   start only (dist/ is already current)
# Custom address or port: HOST_ADDRESS=192.168.1.20 HTTPS_PORT=8745 start.sh
# Stop with Ctrl+C (removes the container but keeps the certificate). For background use, see start-d.sh.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

prepare_preview "$@"

cleanup() {
  echo
  echo "Stopping …"
  compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

print_address
compose up
