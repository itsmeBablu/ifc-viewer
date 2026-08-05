---
name: start-project
description: >-
  Starts the ibviewer (Next.js) project at http://localhost:3000, checking the
  "Babu" git branch (including its sync/merge with main via the merge-babu
  skill), dependencies, the codebase-memory-mcp MCP server, and the state of the
  port. Use when the user asks to start, launch, boot, bring up, or run the
  project, the app, or the dev server.
---

# Starting ibviewer

Run these checks in order. Every step below defaults to "yes" — do not ask the
user for confirmation, since these are covered by the allow-list in
`.cursor/cli.json`. The only exception is when a genuine code or design decision
is required (e.g. which Node version to install, what value an environment
variable should hold) — ask in that case.

**Shell note (Windows PowerShell):** issue each command as its own separate tool
call with the exact canonical command. Do not wrap commands in a `for`/`while`
loop and do not chain unrelated commands together. This keeps each call matchable
against the allow-list and keeps failures attributable to a single command. Note
that Windows PowerShell 5.1 does not support `&&` or bash heredocs — use `;` only
where you genuinely do not care whether the previous command failed, and prefer
separate calls otherwise. If something needs a retry (e.g. the health check),
retry with another separate tool call rather than a shell loop.

## 1. Git branch — always "Babu"

- Run `git fetch origin` to refresh remote refs.
- Check the current branch (`git rev-parse --abbrev-ref HEAD`):
  - If already on `Babu`, continue.
  - If a local `Babu` branch exists, switch to it (`git switch Babu`).
  - If it does not exist locally but `origin/Babu` does, create it as a tracking
    branch (`git switch -c Babu origin/Babu`).
  - If it exists neither locally nor on the remote, tell the user — do not invent
    it and do not silently work on another branch.
- Check that the tree is clean (`git status --porcelain`):
  - If there are uncommitted tracked changes or untracked files, **do not
    continue automatically** — this is the user's decision, since it may be work
    in progress. Report what is pending and wait for instructions.
- Check sync against `origin/Babu`:
  - If the local branch is behind, try `git pull --ff-only origin Babu`
    (fast-forward only; never creates merges or rewrites history).
  - If it has diverged (`--ff-only` fails) or is unexpectedly ahead, tell the
    user and force nothing — no automatic merge, rebase, or reset.
- Only continue to step 2 once the branch is `Babu`, clean, and in sync.

## 2. Sync and merge Babu with main

- Invoke the **`merge-babu`** skill at this point — it is solely responsible for
  that logic (push, conflict detection, squash-merge via PR, branch cleanup). Do
  not duplicate any of it here.
- This step is best effort and non-blocking: if `merge-babu` reports conflicts,
  note the warning for the final summary (step 9) and **continue** with the rest
  of the startup against the current state of `Babu`. A conflict against `main`
  must not stop you from bringing up the local dev server.
- If `merge-babu` completed a squash-merge and recreated `Babu`, you are already
  on the new `Babu` (clean, zero diff against `main`) — run the remaining steps
  against that updated state.

## 3. Node.js version

- Run `node -v`.
- Compare against the `engines.node` field in `package.json`, if present.
- If it does not match, or there is no `engines` field, mention it in the final
  summary but do not block startup — this is informational only.

## 4. Installed dependencies

- Check whether `node_modules` exists and, if so, whether
  `node_modules/.package-lock.json` (the internal lockfile npm writes after
  installing) matches the root `package-lock.json`.
- If `node_modules` is missing, or the lockfiles differ: run `npm ci` (not
  `npm install`, so the lockfile's exact versions are respected).
- If `npm ci` fails, report the real error to the user — do not swallow it and do
  not retry it in a loop.

## 5. codebase-memory-mcp

- Check whether the `codebase-memory-mcp` tools are available (use `GetMcpTools`
  with `server: "codebase-memory-mcp"`).
- **If they are not available** (the MCP server is not installed or registered):
  1. Clone `https://github.com/DeusData/codebase-memory-mcp.git` into a tools
     folder outside this repo, never inside `ibviewer/`.
  2. Follow that repo's README to install dependencies and build/start the MCP
     server.
  3. Register it as an MCP server in `.cursor/mcp.json` and reconnect so its
     tools become available.
- Use `index_status` to check whether **this exact path** is already indexed —
  indexes belonging to other copies of the repo at other paths do not count.
- If it is not indexed, run `index_repository` on this folder.
- If it is already indexed, run `detect_changes` and reindex if anything is
  pending.
- A matching `head_sha` does not guarantee a fresh graph. If `search_graph` or
  `query_graph` results disagree with what is actually on disk, run
  `delete_project` and then `index_repository` for a clean rebuild.

## 6. Environment variables

- Check whether `.env.local` or `.env` exists (as separate calls, not chained).
- If the code references environment variables (`process.env.*`) that are not
  defined in any present `.env*` file, mention it in the final summary.

## 7. Port 3000

- Find out what is holding port 3000 with a single PowerShell call:
  `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue`.
- If something is listening, identify the process with **separate** calls (not
  chained with `;`): first `Get-Process -Id <pid>`, then, in another call,
  `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` to see its command
  line.
  - If it is a `node.exe` process whose command line points at this project
    (`next dev` at this path): kill it (`Stop-Process -Id <pid> -Force`) and
    restart.
  - If it is any other process — including a `next dev` from **another** copy of
    the repo at a different path — **do not kill it**. Tell the user which
    process it is and where it lives, and ask how to proceed.
- Start the dev server in the background: `npm run dev`.

## 8. Health check

- Wait briefly for it to compile, then make a real request with a **single** call:
  `curl http://localhost:3000 -s -o /dev/null -w "%{http_code}"`.
- If it does not respond yet, retry with **another separate tool call** after a
  short wait — Next.js can take a few seconds to compile the first time. Never
  use a `for`/`while` loop in a single call.
- Do not call startup successful just because the process launched — confirm the
  HTTP response.

## 9. Final summary

- If everything above is in order, reply simply
  **"All up to date and awaiting orders"**.
- If something was missing or had to be corrected (dependencies installed, a
  reindex, a process killed, a missing env var, a different Node version,
  `merge-babu` found conflicts, etc.), briefly summarize what was done or what is
  still missing, with no filler.
