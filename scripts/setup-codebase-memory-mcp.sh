#!/usr/bin/env bash
set -euo pipefail

# Sets up codebase-memory-mcp (CBM) for this project.
# Source: https://github.com/DeusData/codebase-memory-mcp
#
# CBM is an MCP server that gives coding agents (Claude Code, Codex, etc.)
# a fast structural knowledge graph of the repo instead of file-by-file
# grep/read exploration. Ships as a single signed static binary; installs
# and auto-configures detected agents.
#
# Usage:
#   ./scripts/setup-codebase-memory-mcp.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v codebase-memory-mcp &>/dev/null; then
    echo "Installing codebase-memory-mcp..."
    curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "codebase-memory-mcp already installed: $(codebase-memory-mcp --version)"
fi

# Index on every MCP session start + keep the index fresh via the
# background git-change watcher (see README's "Auto-Index" section).
codebase-memory-mcp config set auto_index true
codebase-memory-mcp config set auto_watch true

echo "Indexing $REPO_ROOT..."
codebase-memory-mcp cli index_repository --repo-path "$REPO_ROOT" --persistence true

echo ""
echo "Done. Restart your coding agent (Claude Code, Codex, etc.) to pick up the MCP server."
echo "The compressed index at .codebase-memory/graph.db.zst is committed to this repo so"
echo "teammates can bootstrap from it instead of a full re-index."
