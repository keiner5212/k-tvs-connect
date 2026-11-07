#!/usr/bin/env bash
# Headless Ghidra MCP server over HTTP for one binary. Usage: ghidra-mcp-http.sh <binary> [port]
set -euo pipefail

binary="${1:?usage: ghidra-mcp-http.sh <binary> [port]}"
port="${2:-8082}"

export GHIDRA_INSTALL_DIR="${GHIDRA_INSTALL_DIR:-$HOME/tools/ghidra_12.1.4_PUBLIC}"
export JAVA_HOME="${JAVA_HOME:-$HOME/.jabba/jdk/openjdk@21.0.2}"
mkdir -p "$GHIDRA_PROJECTS"

echo "ghidra-mcp http on 127.0.0.1:$port for $binary"
exec ghidra-mcp \
  --headless \
  --binary "$binary" \
  --project "$GHIDRA_PROJECTS" \
  --project-name "$(basename "$binary")" \
  --ghidra-install-dir "$GHIDRA_INSTALL_DIR" \
  --transport streamable-http \
  --mcp-host 127.0.0.1 \
  --mcp-port "$port"
