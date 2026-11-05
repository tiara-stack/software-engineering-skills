# Coordinated mode

Use this reference for every `coordinated-*` route. Complete the phase's
evidence and bookkeeping, then deliver its expected handoff through the
configured worker backend. A local checkpoint or final response alone does
not deliver a control handoff from a top-level worker thread.

Read the `HANDOFF EXPECTED` footer in the initial prompt, current grant, or
continuation. It must identify the coordinator, worker, run, ticket, phase,
expected outcome, handoff ID, backend send operation, and delivery receipt
criterion. Resolve these fields from the registered run and native thread
context; do not guess the target or ID. If they cannot be resolved, record a
delivery blocker and the next action in the run checkpoint without treating
the phase as complete.

At the phase stop point, use the selected backend's handoff operation and
inspect its native receipt or registered dispatch result. Record the receipt
or result reference compactly, then return the same handoff as the final
response when that backend requires it. A send receipt proves delivery
acceptance; the coordinator still checks the reported outcome and evidence
before admitting another phase. On definite transport failure, write a compact
`HANDOFF_DELIVERY_FAILED` checkpoint with the exact target, handoff ID,
observed receipt or error, and next action. For subagent workers, use the
registered dispatch's returned result as the delivery criterion. Follow the
[ticket coordinator worker protocol](../../ticket-coordinator/references/worker-protocol.md)
for the selected backend's contract, handoff names, stack ownership, checks,
quota grants, and stop points. Install both skills together so this reference
resolves.
