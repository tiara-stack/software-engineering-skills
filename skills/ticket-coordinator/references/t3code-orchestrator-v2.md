# T3Code Orchestrator V2 workers

Use this protocol when `worker_backend` is `t3code-orchestrator-v2`. The coordinator uses the agent-facing Orchestrator V2 tools exposed by its current T3Code session. These tools are separate from the older external `t3code-mcp` operations.

## Check capabilities before dispatch

1. Discover the current tool descriptions. Require `orchestrator_capabilities`, a durable top-level thread launch with `workspaceStrategy` for a new isolated worktree, thread list/read/send/wait/interruption, and native worktree inspection and guarded discard. Read the live schemas and supported results instead of guessing fields.
2. Confirm that the ticket-routed provider/model, or the inherited default, is available through `orchestrator_capabilities`, and that launch can set and verify `full-access`. If V2, isolated worktree launch, source-aware thread readback, or guarded worktree cleanup is unavailable, pause before dispatch and report the missing capability. Keep the configured backend fixed. The older `t3code-mcp` tools do not satisfy this backend's capability check.

## Start one worker per ticket

1. Resolve the coordinator's exact T3Code `projectId` and `threadId` from capability and thread-read results. Record both in shared run state and pass them to every worker. On resume, confirm they still identify the coordinator thread.
2. Launch one durable top-level worker thread per eligible ticket with `t3_thread_launch`. Request a new isolated worktree, set `full-access` explicitly, and use an available provider/model from `orchestrator_capabilities`. Apply ticket routing metadata when the live catalog supports it; use an explicit project mapping or pause when it does not. A `delegate_task` child is task-scoped, and `create_threads` shares the current checkout, so neither is the registered worker for this workflow.
3. Before submitting the ticket prompt, verify the launched thread belongs to the coordinator's project, reports `full-access`, and has its own branch and worktree path. Confirm that path and branch differ from every other active ticket worker. Record the worker's exact `threadId`, current `runId`, branch, and worktree path in shared state. If launch status is uncertain, reconcile any native request ID with the thread list and thread state before retrying; never create a duplicate worker.
4. Include the run ID, exact ticket, phase, worker thread ID, coordinator project/thread IDs, and unique handoff ID in the worker prompt. Tell it to run `$autonomous-development coordinated-implement`; if Matt Pocock's `$implement` is installed, follow it too.

## Verify handoffs and grant phases

1. Keep the shared `TICKET_COORDINATOR v1` envelope for V2. For each handoff, require the worker to call `t3_thread_send` to the exact coordinator thread, with a unique `clientRequestId` equal to the envelope's `message_id`, and then return the same handoff as its final visible response. The worker stops until the coordinator grants its next phase.
2. Verify the send in the registered worker thread's activity. Confirm its target and `clientRequestId` match the expected coordinator identity and handoff. Read the coordinator timeline and match the envelope to its native message ID and source metadata. Reconcile the send result, worker run, visible response, and worktree before advancing. A delivered message does not prove its reported checks or repository state.
3. Grant each next phase by sending a `PHASE_GRANT` to the registered worker thread with `t3_thread_send`. Use the envelope's `message_id` as the unique `clientRequestId`, verify the result names that exact thread, and record its returned `runId`. Require the worker to stop after its next valid handoff. Keep the same worker attached to its ticket through stack rebase and review. For review grants, the worker thread runs the configured reviewers; do not launch reviewer agents from the coordinator thread.
4. Wait on each exact `runId` with `t3_thread_wait` or an equivalent one-shot wait. A timeout does not cancel the run. Keep its identity, read the thread and worktree state, then wait again or resume that same thread. If a run ends without the expected handoff, inspect its activity and worktree and ask the same worker to submit the missing handoff. Do not dispatch another worker for the ticket.
5. If a launch, handoff, or grant has an uncertain result, read the native thread and message state before retrying. Reuse a `clientRequestId` only for the same action; never issue a new request ID while the earlier action might have committed.

## Preserve worktree and cleanup guards

1. Use the T3Code native worktree inspection and discard operations. Before cleanup after confirmed merge, inspect the exact project and worktree, every referencing thread, active runs, and pending requests.
2. Discard only when the native guard confirms the worktree is an orphan or the ticket worker is its sole reference, with no active or pending work. If the discard operation requires an explicit sole-thread target, name the registered worker thread. Preserve the branch. If the harness cannot establish those conditions, preserve the worktree and pause cleanup.
3. Apply the coordinator's existing stack-order, quota, review, merge-label, and merge-observation rules without change. A V2 worker handoff does not change who owns those decisions.
