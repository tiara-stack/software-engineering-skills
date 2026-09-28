# Ticket coordinator configuration

Read the consuming repository's canonical root instructions first. They may point to a custom coordinator config or define the stack tool. Otherwise read `.agents/ticket-coordinator.yaml`.

Use explicit settings over inferred values. When `stack_backend` is absent, infer it only if the repository instructions name one supported stack tool. Stop and ask when the backend is missing or ambiguous. Require `worker_backend` in config or as a per-run override; never switch backends silently.

## Example

Use the copyable [coordinator config template](../assets/ticket-coordinator.example.yaml). Replace its `CHANGE_ME` values with tools and reviewer IDs from the consuming project. The `rolling_window` blocks are optional when a service does not publish a usable limit. `max_workers` defaults to 2 and `max_active` defaults to 1.

## Settings

- `worker_backend` selects `subagent` or `t3code-mcp`. A per-run override takes precedence. Verify the selected backend before dispatch. If T3Code MCP is selected, require its worktree and thread-control operations to be available.
- `max_workers` limits active implementation workers. Use 2 when omitted.
- `stack_backend` selects the consuming project's branch and PR stack workflow. Respect repository instructions, installed tools, and the configured backend. Do not assume Graphite or GitHub native stacks from the skill repository.
- Read `merge_label` from the consuming project's autonomous-development configuration. It must be an existing label that repository instructions identify as merge-queue admission. Never create or guess a label, and never substitute a direct merge.
- `review_pools` maps reviewer identifiers to quota pools. Keep local and hosted pools separate. Put reviewers that share the same service account and quota in one pool; use separate pools when the accounts or quotas differ. Do not store credentials here.
- When Matt Pocock's `$implement` is installed, include its `/code-review` step as a local reviewer and map it to the correct local quota pool.
- `max_active` limits concurrent review loops using a pool. The default is 1.
- `rolling_window.max_invocations` and `window_seconds` describe a known service limit. Count each invocation of a local reviewer and each hosted review trigger. A hosted pool stays reserved from the project's hosted-review trigger, usually undraft, until the coordinator applies the merge label, including time when the worker re-enters local review.

The default shared state directory is under the Git common directory, outside worker worktrees. It holds ticket, PR, branch, worktree, stack-order, quota-window, reservation, and cooldown identifiers so concurrent or resumed runs can reconcile one another. Use an instruction-defined shared state path when available. Update it under an exclusive process lock. If the environment has no safe shared lock, allow only one active coordinator run per consuming repository. Store no credentials or review ledger content. Remove per-ticket run records after merge and worktree cleanup; retain quota counters and cooldowns only until their configured windows expire. Release local reservations after each local review pass; release hosted reservations after merge-label admission. Honor service-provided retry windows and update the shared cooldown before admitting another loop.

If a reviewer has no configured pool, assign it a unique pool with one active loop. Never assume two reviewer identifiers share a quota account without configuration.
