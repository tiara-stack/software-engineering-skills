# Checkpoints and ledger

Use Git objects and refs for reviewed snapshots, and plain text files under the worktree's Git directory for completed reports. Do not create a database, dependency graph, or helper CLI.

## Identify review state

From the repository root, derive stable keys for the worktree and branch without using branch names as file paths. Run this block in Bash; it uses Bash dynamic file descriptors and the host's `flock` command. Keep this Bash process alive and run the remaining command blocks in it through report save and ref update, so the lock stays held.

```bash
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
git_dir=$(git rev-parse --absolute-git-dir)
worktree_key=$(printf '%s' "$repo_root" | git hash-object --stdin)
branch=$(git branch --show-current)
if test -z "$branch"; then branch=detached; fi
branch_key=$(printf '%s' "$branch" | git hash-object --stdin)
state_dir="$git_dir/agentic-review/$worktree_key/$branch_key"
mkdir -p "$state_dir"
lock_file="$state_dir/run.lock"
exec {review_lock_fd}>"$lock_file"
flock "$review_lock_fd" || exit 1
run_reservation=
temp_index=
cleanup_review_run() {
  test -z "$temp_index" || rm -f "$temp_index"
  test -z "$run_reservation" || rm -f "$run_reservation"
  flock -u "$review_lock_fd"
}
trap cleanup_review_run EXIT
latest_ref="refs/agentic-review/latest/$worktree_key/$branch_key"
previous_completed_checkpoint=$(git rev-parse --verify "$latest_ref^{commit}" 2>/dev/null || true)
```

Acquire the exclusive OS lock before reading `latest_ref` or
`previous_completed_checkpoint`. `flock` acquires it atomically and releases it
when the process exits, including after a crash. Keep the lock file; its
presence does not mean the lock is held. Do not remove it based on age. If
`flock` is unavailable, use an equivalent OS lock. If no safe lock primitive is
available, serialize runs so only one starts for this worktree and branch.
Hold the lock through checkpoint creation, reviewer completion, atomic report
save, and the compare-and-swap update. This lock admits only one run for the
same worktree and branch.

The latest ref names the last completed checkpoint. Preserve every checkpoint
under `refs/agentic-review/checkpoints/<worktree-key>/<branch-key>/<run-id>`.
Keep one run report at `$state_dir/runs/<run-id>.md` with its base, checkpoint,
coverage, findings, prior-finding statuses, and unresolved findings to carry
forward. For each coverage item, record reviewer and model, covered paths or
behavior category, source identity, specification identity, generated-input
identity, rule/configuration identity, and carry decision with scope evidence.
Source identity names the relevant commits or content hashes for reviewed code
and dependencies. Specification identity names the approved requirement
source and a commit or content hash of the exact text supplied to the reviewer.
Generated-input identity names the generator and version, relevant
configuration and input identities, and generated output identity when
generated artifacts affect the review. Rule identity names the applicable
instruction and review configuration versions. Do not hash unrelated refs or
native review checkpoints as product source.

For every reviewer invocation, record a unique task/invocation ID, pinned
checkpoint, native result or result reference, assigned scope, reviewer and
model, and IDs of prior findings assigned for recheck. If the backend provides
no invocation ID, assign a unique ID within the run and mark the native ID
unavailable. The run ID in the latest completed checkpoint's commit message
identifies its report. Keep checkpoint and report history unless the developer
asks to prune it. Keep refs and reports local; do not push them.

Within one locked run, dispatch independent aspect reviewers concurrently
against the same pinned checkpoint when their inputs and configured quota
allow it. Keep each result separate by invocation ID, reviewer, model,
assigned scope, and prior findings. The run coordinator alone combines results
and writes the single report atomically after every required reviewer finishes.
Concurrent aspect reviewers do not create competing checkpoints or reports,
and must not update `latest_ref` themselves. If any reviewer fails, leave the
report incomplete and `latest_ref` unchanged.

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

Compute one diff from the selected base to the new checkpoint. Use that range for every dispatched reviewer. Compare source, specification, generated-input, and rule identities with the prior report, including when the Git diff is empty. Reuse coverage only for named unchanged scope whose identities still match. Changes to shared analysis, configuration, approved requirements, dependencies, generator inputs, or generated outputs invalidate coverage they can affect. When affected scope is unclear, dispatch review again. If there is no `HEAD` and no caller base, create an empty tree with `git hash-object -t tree -w --stdin </dev/null` and use it as the base. Recheck every unresolved finding with its assigned reviewer. Save a no-changes report only when the diff and unresolved findings are empty and all carried coverage has matching identities and scope evidence. If an identity changes, invalidate affected coverage and dispatch its assigned reviewers even when the Git diff is empty.

When a generated-input identity changes but the Git diff is empty, give the
assigned reviewers the changed input or a safe, reviewable representation,
its identity and provenance, and the affected current source scope. Include
scope evidence that links the input to those source paths or behavior
categories. Record this payload and coverage in the report. Keep the spec
reviewer's existing raw-requirements and implementation-diff payload
unchanged.

## Capture a checkpoint without changing the user's index

Capture tracked files and unignored untracked files from the on-disk working tree. A separate temporary index leaves the real index, branch, and files untouched. Tracked files are captured even when ignored. Partial staging is represented as the current file contents, not as the partial index.

When `HEAD` exists, seed the temporary index from it. Without `HEAD`, copy the real index when one exists so force-staged ignored files survive. Use an empty index only when both `HEAD` and the real index are absent. A caller-supplied base is the comparison baseline, not the capture seed.

```bash
head=$(git rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)
temp_index=$(mktemp)
real_index=$(git rev-parse --git-path index)

if test -n "$head"; then
  GIT_INDEX_FILE="$temp_index" git read-tree "$head"
elif test -f "$real_index"; then
  cp "$real_index" "$temp_index"
else
  GIT_INDEX_FILE="$temp_index" git read-tree --empty
fi
GIT_INDEX_FILE="$temp_index" git add -A -- .
tree=$(GIT_INDEX_FILE="$temp_index" git write-tree)
run_stamp=$(date -u +%Y%m%dT%H%M%SZ)
run_attempt=0
while :; do
  run_reservation=$(mktemp "$state_dir/run-$run_stamp-$run_attempt-XXXXXXXX") || exit 1
  run_id=${run_reservation##*/}
  checkpoint_ref="refs/agentic-review/checkpoints/$worktree_key/$branch_key/$run_id"
  report_path="$state_dir/runs/$run_id.md"
  if git show-ref --verify --quiet "$checkpoint_ref" || test -e "$report_path"; then
    rm -f "$run_reservation"
    run_reservation=
    run_attempt=$((run_attempt + 1))
  else
    break
  fi
done

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

git update-ref "$checkpoint_ref" "$checkpoint"
```

`mktemp` atomically reserves each run ID under the lock. Before capture, the
loop also checks that neither its checkpoint ref nor report path already
exists. The exit handler removes the active reservation. If a process is
killed before cleanup, the leftover file makes `mktemp` choose another name.

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
