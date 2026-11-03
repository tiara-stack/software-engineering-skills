# Recovery checkpoints and saved-file retention

Use this reference when resuming a coordinator run or pruning saved files under
`.git/ticket-coordinator/recovery`. It covers recovery files only. Conversation
history and application state have separate owners and supported operations.

## Keep one current checkpoint

Keep one authoritative run-level checkpoint for each accepted source and
phase. Its active-worker index enumerates every ticket, registered worker
identity, and per-worker checkpoint reference. The referenced worker
checkpoint records its native run, current head, phase, grant, and expected
handoff. Replace the run-level checkpoint when the run advances. Include only
what the next coordinator needs:

- source and base;
- quota state and eligible work lane;
- unresolved findings and their dispositions;
- valid carried evidence with canonical result references;
- the next concrete action.

Keep concise finding and gate ledgers that point to canonical reviewer and
command results. Do not copy full reports or nest prior checkpoints. Publish a
replacement to a temporary path, validate its required fields and references,
then atomically rename it into place. Keep the prior valid checkpoint until
the replacement is usable. After interruption, read the run-level checkpoint,
reconcile every listed worker and per-worker checkpoint against live run
state, then read the current delta, outstanding findings, and a small recent
thread tail. Resolve discrepancies before dispatch so no active worker is
skipped or duplicated. Immediately before each launch, acquire the exclusive
process lock, reread and reconcile the active-worker index, resolve any
discrepancy, and record a pending launch with its backend request ID in that
index. For APIs without a caller-supplied request ID, record a stable launch ID
in the launch title or task prompt so the live thread list can find it. Release
the lock before calling the backend. Reuse an ID only for retries of that same
launch. On resume, if no worker identity is registered, reconcile the recorded
ID against the live thread list and thread state before retrying. Resolve
uncertain outcomes first. Open raw history only to resolve a specific
dependency or dispute. Reuse valid results instead of rerunning checks or
copying their output for bookkeeping.

Each required review round still gets the original brief and its required
prior findings, responses, and unresolved objections. Carry those compactly
with stable references to the raw evidence. A reference must identify a result
that can be read and verified.

## Prune only authorized, obsolete files

Prune saved recovery files only when the user authorizes it or the consuming
project states a retention policy. Follow the requested path and file scope.
Build retention roots from live runs, active or current evidence, final
accepted checkpoints, unresolved or binding decisions, evidence required for
carry-forward, canonical source and coverage results needed to justify current
acceptance, active locks and grants, and files in use by processes. Keep the
evidence that current decisions depend on. Do not keep every historical state
snapshot merely because a newer snapshot refers to its existence.

Delete only files shown to be obsolete, unreferenced duplicate intermediate
records, abandoned preflights, or disposable dependency/install scratch from a
completed phase. Work in small batches under the applicable state lock. Check
references and concurrent writes before each batch, use bounded memory, and
verify paths and results after deletion. Keep one compact batch-level manifest
with removed paths and reasons, retained roots, and blocked categories. Do not
make a second full backup or quarantine tree, or emit a per-file manifest for
large scratch trees.

Report logical bytes removed separately from filesystem space reclaimed.
Shared hard links and concurrent writes can make those numbers differ. Cleanup
must not delay implementation or review. Preserve source, worktrees, branches,
stashes, and unrelated data. Use supported application operations for
conversation or database management. This file policy never permits raw
SQLite or event-store deletion.

## Resume honestly

Use native completion and watch operations when available, then reconcile
interrupted work idempotently against the checkpoint and live run state. A
cancelled or completed coordinator cannot wake itself. If no runtime trigger
can continue it, record the precise resume point and next command for a later
invocation. File cleanup may relieve disk pressure, but it does not compact an
application database or establish a fix for memory limits or server restarts.
