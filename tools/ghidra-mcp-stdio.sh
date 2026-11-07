#!/usr/bin/env bash
# GhidraMCP server over stdio for an MCP client (Claude Code, k-agent, VS Code).
# GUI mode: Ghidra must be running with the GhidraMCP plugin enabled on port 8080.
set -euo pipefail

export GHIDRA_INSTALL_DIR="${GHIDRA_INSTALL_DIR:-$HOME/tools/ghidra_12.1.4_PUBLIC}"
export JAVA_HOME="${JAVA_HOME:-$HOME/.jabba/jdk/openjdk@21.0.2}"

exec ghidra-mcp --ghidra-server "${GHIDRA_SERVER:-http://127.0.0.1:8080/}"
