---
name: merge-babu
description: >-
  Syncs the "Babu" branch with main -- pushes if needed, detects conflicts
  non-destructively and, if there are none, squash-and-merges via a GitHub PR and
  leaves Babu clean and ready for the next cycle. The single stopping point is a
  merge conflict. Use when the user asks to sync, update, or merge the Babu
  branch with main, or when start-project invokes it as part of project startup.
---

# Syncing and merging "Babu" into "main"

This skill runs start to finish **without asking the user for confirmation**,
with the single exception of merge conflicts being detected (step 4) — there it
stops and reports, and never resolves anything on its own.

**Shell note:** issue each git command as its own separate tool call with the
exact command, rather than chaining unrelated commands with `;`, `&&`, or `|`.
Windows PowerShell 5.1 does not support `&&` or bash heredocs, so pass multi-line
commit or PR bodies via a file (`git commit -F <file>`, `gh pr create --body-file
<file>`) instead of a heredoc.

## Precondition

- The active branch must be `Babu` and the working tree must be clean (no
  uncommitted changes and no untracked files awaiting a decision). If that is not
  the case, do not continue — report it and stop. When invoked by
  `start-project`, this was already verified immediately beforehand.

## 1. Fetch and compare

- `git fetch origin`.
- Compare local `Babu` against `origin/Babu`:
  - If local is ahead: `git push origin Babu`.
  - If they have diverged (local and remote each hold commits the other does
    not): stop and report it — never force-push.
- Compare `origin/Babu` against `origin/main` (`git log origin/main..origin/Babu`):
  if `Babu` has no commits of its own that `main` does not already have, report
  "nothing to merge" and finish here without touching anything else.

## 2. Bring main into Babu

- If `origin/main` has commits that `Babu` does not, integrate them into `Babu`
  first (`git merge origin/main` or `git rebase origin/main`, whichever leaves the
  simpler history for this case). That way any integration problem surfaces on
  your personal branch rather than the shared one.

## 3. Merge simulation (non-destructive)

- Use `git merge-tree` to check whether merging `Babu` into `main` would produce
  conflicts, without touching the real working tree.

## 4. Stopping point — conflicts

- **If `merge-tree` reports conflicts:** stop. Do not resolve them by any
  automatic means — they need human judgment about which version is correct.
  Report which files and hunks clash and end the skill here (do not proceed to
  the PR or the squash-merge).
- **If there are no conflicts:** continue without asking for anything further.

## 5. PR and squash-merge

- `gh pr create --base main --head Babu` with a title and body derived from
  `Babu`'s actual commits, not generic text.
- `gh pr merge --squash` on that PR.
- Note: this repository has no branch protection and no CI configured — the merge
  simulation in step 3 is the only real gate before touching `main`.

## 6. Leave Babu clean

- After the squash-merge, delete `Babu` locally (`git branch -D Babu`) and
  remotely (`git push origin --delete Babu`), then recreate it from the updated
  `main`: `git fetch origin`, then `git checkout -b Babu origin/main`, then
  `git push -u origin Babu`.
- That batch of work is already safe in `main` via the squash commit — this step
  only clears the individual commit history for the next cycle, it does not
  delete code.

## 7. Summary

Always report, briefly:
- Whether `Babu` was pushed beforehand.
- Whether conflicts were detected, and which ones — in that case, none of the
  steps below happened.
- The SHA of the squash commit on `main`, if the merge went through.
- Confirmation that `Babu` was recreated and synced with `main`, or the reason
  that point was never reached.
