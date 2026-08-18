<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Permissions: what to ask about, what not to

- **Never ask for confirmation on tool permissions** — Bash, MCP tools (`codebase-memory-mcp`, etc.), file edits. `defaultMode` is `bypassPermissions` both globally and in this repo's `.claude/settings.local.json`; that setting is the approval. Don't pause to confirm a `git`, `npm`, `gh`, or MCP call just because it's the kind of thing that could theoretically prompt — proceed.
- **Do ask** when the answer is genuinely the user's to make and isn't derivable from the repo or this file — product/design intent, ambiguous UX tradeoffs, which of several valid approaches they want, or a destructive/hard-to-reverse git action (force-push, `reset --hard` on unbacked-up work, merging into `upstream`, deleting a branch) that wasn't explicitly requested in the moment. The line is: tool mechanics never need a question; decisions only the user has the context for always might.
- A prior approval doesn't carry forward automatically — e.g. "merge Babu into main" today doesn't imply the same for a future unrelated task; ask again if it's a fresh instance of a risky action, not because the tool itself needs permission.

## Code exploration (codebase-memory-mcp)

This project has the `codebase-memory-mcp` MCP server installed and indexed.
- **Prefer its tools over Grep/Glob for code-structure questions** — `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`, `search_code`. They answer from a pre-built graph (functions, calls, cross-references) instead of grepping/reading files repeatedly.
- **Still use Grep/Glob/Read directly** for plain text, config files, and non-code files, and always `Read` a file before editing it.
- **If the project isn't indexed yet**, run `index_repository` first.
- **A matching `head_sha` does not guarantee a fresh graph.** `index_status`/`list_projects` can report the correct `head_sha` while still holding a stale node/edge set (e.g. `Folder` nodes for subdirectories — `components/floors/`, `layout/`, `legend/`, `viewer/` — that no longer exist on disk after a flattening refactor). A plain `index_repository` call is not guaranteed to prune those orphaned nodes even when it reports `"status":"indexed"` (same node/edge counts before and after is the tell). If `search_graph`/`query_graph` results don't match what's actually on disk, `delete_project` then `index_repository` for a clean rebuild before trusting the graph for anything.

## First time on a new machine

This MCP is installed **globally for the user's Claude Code**, not part of this repo — cloning `ibviewer` does not bring it along, and this project's own `.claude/settings.local.json` (pre-approved bash/MCP permissions) is gitignored too, so both need to exist on the machine you're working from.

1. `npm install` (see README for the rest of the dev-server workflow).
2. Check whether `codebase-memory-mcp` is already available (e.g. `command -v codebase-memory-mcp`, or look for `~/.local/bin/codebase-memory-mcp*`). If it's missing:
   - **Confirm with the user before installing it** — it writes to this machine's global Claude Code (and Codex/VS Code, if detected) config, not just this project, so it's not a call to make silently on a machine no one has approved it on yet.
   - Installer + source: https://github.com/DeusData/codebase-memory-mcp (`install.sh` / `install.ps1` per the README there). Download the script and read it before running it rather than piping straight into `bash`/PowerShell.
   - After installing, restart the Claude Code session so the MCP + hooks load.
3. Once it's installed (here or already present) and this project hasn't been indexed yet, run `index_repository`.

## Development workflow

- **Dev server always on**: when starting development work, check `localhost:3000` first (`lsof -i :3000` + a `curl` for a 200). If it's already up, leave it running. If not, launch `npm run dev` and keep it running for the rest of the session so changes are visible live in the browser — don't kill it between tasks.
- **Work branch**: develop on `Babu`, never directly on `main`.
  - Confirm where you are with `git rev-parse --abbrev-ref HEAD`; don't assume.
  - Remote `origin` is `itsmeBablu/ifc_revit_heizlast` (GitHub may also list it as `ifc-viewer`). Default to reading/pushing against `origin` only.
- **All changes stay on `Babu` until told otherwise**: commit and push there. Never merge `Babu` into `main` unless the user explicitly asks for that specific task — use the `merge-babu` skill when they do.
- **After a merge into `main`**: reset `Babu` to match (`git checkout Babu && git reset --hard main`, then push if it's a fast-forward) — only when asked.
- **End-of-task loop** — run automatically, without asking, whenever a coding task is finished:
  1. Run `npm run lint`. There is no `typecheck`/`test`/`test:e2e` script in this repo yet (no test suite is wired up) — if the user adds one later, fold it into this loop instead of running raw `tsc`/test binaries ad hoc.
  2. Commit and push `Babu` to `origin`.
  3. If lint is clean: tell the user the branch is ready and stop — do not open a PR or touch `main`/`upstream` unless asked.
  4. If lint fails: review the failure, fix the code, and repeat from step 1.
