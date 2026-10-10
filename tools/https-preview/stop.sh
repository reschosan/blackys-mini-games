#!/bin/sh
# Stops the HTTPS preview (after start-d.sh; start.sh cleans up on Ctrl+C).
#   stop.sh          remove the container, keep the certificate so phones continue to trust it
#   stop.sh --all    also remove the certificate; the next start creates a new one
# Runs from any directory with any shell.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed"

if [ "${1:-}" = "--all" ]; then
  compose_for_stopping down -v
  echo "Preview stopped; certificate removed."
else
  compose_for_stopping down
  echo "Preview stopped."
fi
