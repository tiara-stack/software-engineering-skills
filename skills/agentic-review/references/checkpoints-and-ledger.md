# Checkpoints and ledger

Use Git objects and refs for reviewed snapshots, and plain text files under the worktree's Git directory for completed reports. Do not create a database, dependency graph, or helper CLI.

## Identify review state

From the repository root, derive stable keys for the worktree and branch without using branch names as file paths:

```sh
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
git_dir=$(git rev-parse --absolute-git-dir)
worktree_key=$(printf '%s' "$repo_root" | git hash-object --stdin)
branch=$(git branch --show-current)
if test -z "$branch"; then branch=detached; fi
branch_key=$(printf '%s' "$branch" | git hash-object --stdin)
state_dir="$git_dir/agentic-review/$worktree_key/$branch_key"
latest_ref="refs/agentic-review/latest/$worktree_key/$branch_key"
previous_completed_checkpoint=$(git rev-parse --verify "$latest_ref^{commit}" 2>/dev/null || true)
```

The latest ref points to the last completed checkpoint. Preserve every checkpoint under `refs/agentic-review/checkpoints/<worktree-key>/<branch-key>/<run-id>`. Keep one run report at `$state_dir/runs/<run-id>.md`; include its base, checkpoint, coverage, findings, prior-finding statuses, and unresolved findings to carry forward. The latest completed checkpoint commit message contains the run ID, which identifies its report. Keep checkpoint and report history unless the developer asks to prune it. Run only one review at a time for the same worktree and branch. Keep refs and reports local; do not push them.

## Select the base

Use the commit named by `latest_ref` when it exists. On the first run, resolve a caller-supplied base as a commit; otherwise use `HEAD`. If the repository has no `HEAD` and no caller base, use the empty tree as the base. A caller can request a deliberate baseline reset; record the reset in the report. Read the latest report before reviewing to recover its unresolved findings:

```sh
if test -n "$previous_completed_checkpoint"; then
  latest_run_id=$(git log -1 --format=%s "$latest_ref" | sed 's/^agentic-review checkpoint //')
  latest_report="$state_dir/runs/$latest_run_id.md"
else
  latest_report=
fi
```

Compute one diff from the selected base to the new checkpoint. Use that same range for every reviewer. If there is no `HEAD` and no caller base, create an empty tree with `git hash-object -t tree -w --stdin </dev/null` and use it as the base. If the diff is empty but prior unresolved findings exist, dispatch their assigned reviewers to recheck them. If both the diff and unresolved findings are empty, save a no-changes report and complete the checkpoint without dispatching reviewers.

## Capture a checkpoint without changing the user's index

Capture tracked files and unignored untracked files from the on-disk working tree. A separate temporary index leaves the real index, branch, and files untouched. Tracked files are captured even when ignored. Partial staging is represented as the current file contents, not as the partial index.

```sh
head=$(git rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)
temp_index=$(mktemp)
trap 'rm -f "$temp_index"' EXIT

if test -n "$head"; then
  GIT_INDEX_FILE="$temp_index" git read-tree "$head"
fi
GIT_INDEX_FILE="$temp_index" git add -A -- .
tree=$(GIT_INDEX_FILE="$temp_index" git write-tree)
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"

if test -n "$head"; then
  checkpoint=$(GIT_AUTHOR_NAME='Agentic Review' \
    GIT_AUTHOR_EMAIL='agentic-review@users.noreply.github.com' \
    GIT_COMMITTER_NAME='Agentic Review' \
    GIT_COMMITTER_EMAIL='agentic-review@users.noreply.github.com' \
    git commit-tree "$tree" -p "$head" -m "agentic-review checkpoint $run_id")
else
  checkpoint=$(GIT_AUTHOR_NAME='Agentic Review' \
    GIT_AUTHOR_EMAIL='agentic-review@users.noreply.github.com' \
    GIT_COMMITTER_NAME='Agentic Review' \
    GIT_COMMITTER_EMAIL='agentic-review@users.noreply.github.com' \
    git commit-tree "$tree" -m "agentic-review checkpoint $run_id")
fi

checkpoint_ref="refs/agentic-review/checkpoints/$worktree_key/$branch_key/$run_id"
git update-ref "$checkpoint_ref" "$checkpoint"
```

Before capture, inspect `git status --short --untracked-files=all`, the diff from the selected base, and the contents of changed untracked files for credentials, private keys, tokens, or sensitive local data. Do not repeat possible secret values in tool output or reports. If one may be present, stop before checkpointing and report only the path.

After capture, compute the diff with `git diff --no-ext-diff --find-renames <base> <checkpoint> --`. Give each risk reviewer a code-and-test slice that omits authoritative spec paths and issue text. Give the spec reviewer the full implementation diff and raw spec.

## Save a completed run

Create `$state_dir/runs/` if needed. Write the full report and unresolved-finding set to a new file in that directory. Save the file atomically. Only after it is saved and every required reviewer completed, update `latest_ref` to the new checkpoint. Use compare-and-swap so a concurrent run cannot move the baseline unexpectedly:

```sh
if test -n "$previous_completed_checkpoint"; then
  printf 'update %s %s %s\n' "$latest_ref" "$checkpoint" "$previous_completed_checkpoint" | git update-ref --stdin
else
  printf 'create %s %s\n' "$latest_ref" "$checkpoint" | git update-ref --stdin
fi
```

If any reviewer fails, the report cannot be saved, or the ref update fails, leave `latest_ref` unchanged so the next run covers the same delta. If the ref update fails after the report was saved, mark that ledger entry incomplete when possible. A run report counts as completed only when `latest_ref` points to its checkpoint. Report an incomplete run and any partial findings to the caller.

Never move or delete the user's branch, update the real index, clean the worktree, or commit to a user branch. Do not prune review refs or ledger entries automatically.
