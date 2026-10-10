# Shared by start.sh and start-d.sh: checks Docker, finds the LAN address, and builds the game.
# Sourced by the start scripts (". common.sh"), not executed directly; they set SCRIPT_DIR first.

REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yaml"
HTTPS_PORT="${HTTPS_PORT:-8745}"

fail() {
  echo "Error: $1" >&2
  exit 1
}

# The address of this computer in the local network: macOS asks the default route's interface, Linux (Raspberry Pi) asks which source address
# the default route would use (a lookup in the own routing table, nothing is sent), and falls back to the first address of `hostname -I`.
lan_address() {
  if command -v ipconfig >/dev/null 2>&1; then
    interface="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')"
    [ -n "${interface}" ] && ipconfig getifaddr "${interface}" 2>/dev/null && return 0
  fi
  if command -v ip >/dev/null 2>&1; then
    address="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
    [ -n "${address}" ] && echo "${address}" && return 0
  fi
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

# The name this computer has in the local network, the one name.local reaches: macOS keeps it as its local host name (Bonjour),
# Linux (Raspberry Pi) as its host name. Without a domain part and in small letters, the way certificates hold names.
host_name() {
  name=""
  if command -v scutil >/dev/null 2>&1; then
    name="$(scutil --get LocalHostName 2>/dev/null || true)"
  fi
  [ -n "${name}" ] || name="$(hostname 2>/dev/null || true)"
  echo "${name%%.*}" | tr '[:upper:]' '[:lower:]'
}

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

# docker compose checks while reading the file that HOST_ADDRESS and HOST_NAME are set, also for stopping, where they do not matter.
compose_for_stopping() {
  HOST_ADDRESS="${HOST_ADDRESS:-stopping}" HOST_NAME="${HOST_NAME:-stopping}" compose "$@"
}

# Checks prerequisites, builds the game unless --no-build is set, and configures Docker Compose.
prepare_preview() {
  [ -f "${COMPOSE_FILE}" ] || fail "docker-compose.yaml is missing in ${SCRIPT_DIR}"
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed"
  docker info >/dev/null 2>&1 || fail "Docker is not running or this user cannot access it (Mac: start Docker Desktop; Linux/Pi: start the Docker service or run 'sudo usermod -aG docker \$USER', then sign in again)"
  docker compose version >/dev/null 2>&1 || fail "'docker compose' is unavailable (Linux/Pi: install docker-compose-plugin)"

  HOST_ADDRESS="${HOST_ADDRESS:-$(lan_address)}"
  [ -n "${HOST_ADDRESS}" ] || fail "LAN address not found. Connect to Wi-Fi or set HOST_ADDRESS=<address>."
  HOST_NAME="${HOST_NAME:-$(host_name)}"
  [ -n "${HOST_NAME}" ] || fail "Computer name not found. Set HOST_NAME=<name>."
  export HOST_ADDRESS HOST_NAME HTTPS_PORT

  if [ "${1:-}" != "--no-build" ]; then
    echo "Building the game in ${REPO_ROOT} …"
    (cd "${REPO_ROOT}" && npm run build) || fail "The build failed"
  fi
  [ -f "${REPO_ROOT}/dist/index.html" ] || fail "dist/index.html is missing. Start without --no-build to build it."
}

print_address() {
  echo "Available at (phones must be on the same Wi-Fi network, not a guest network):"
  echo "  https://${HOST_ADDRESS}:${HTTPS_PORT}/"
  echo "  https://${HOST_NAME}.local:${HTTPS_PORT}/"
  echo "  https://${HOST_NAME}:${HTTPS_PORT}/   (only if the router resolves this name)"
  echo "The certificate covers all three addresses."
  echo "For iPhone certificate setup, see ${SCRIPT_DIR}/README.md, 'Trust the certificate on your phone'."
}
