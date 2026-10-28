# Incremental repair and review

Use this procedure during an authorized implementation, CI, or review phase.
The worker owns diagnosis, in-scope repair, focused validation, and required
reruns until the phase gates pass. Routine command or review failures do not
need a new repair grant. The coordinator still controls phase transitions,
scope or product decisions, reviewer quota, and shared-resource scheduling.

## Repair and validate

1. Diagnose a failure from its actual command, output, exit status, source
   identity, and relevant configuration. Retry only when evidence points to a
   transient failure and the project's retry procedure permits it.
2. Derive a finite coverage matrix from approved requirements and actual
   interfaces. Group equivalent call, import, alias, mutation, and execution
   forms into categories. Include meaningful negative controls where they
   separate intended behavior from accidental matches.
3. Repair the category, not only the reported example. Check public behavior
   against independent inventories or semantics-preserving variants when
   available. Inspect shared analysis and consolidate inconsistent copies
   when the defect crosses them. A broad rewrite is not required.
4. When related findings recur across repair rounds or expose interacting
   lifecycle or deadline behavior, collect adjacent findings before another
   narrow repair. Derive a finite behavior matrix from the approved contract
   and actual callers. Map reachable caller/state combinations and observable
   outcomes, including failure, interruption, retry, cleanup, reporting, and
   ownership paths. For timing changes, cover fresh, resumed, legacy, expired,
   and unknown state where reachable, plus delays during persistence,
   acknowledgement, cleanup or report handoff, and reporting. Within one
   attempt, a persisted absolute deadline cannot move later because a caller
   reconstructs it from sampled remaining time. An explicitly authorized new
   attempt may receive a new deadline under the approved contract. Test each
   distinct reachable behavior with assertions that distinguish nearby
   outcomes. Reuse a small helper when it clarifies the contract; do not add a
   generic test framework or require a module rewrite. Keep this step
   conditional on recurring related findings or interacting transitions.
5. Read the consuming repository's scripts, dependency scope, and documented
   allowances. Run affected-package checks and affected dependents, including
   required type, configuration, format, lint, and build checks where the
   project permits scoped validation. Respect command ordering. Record carried
   and skipped scope. Broad configuration, schema, dependency, generated-input,
   or uncertain-impact changes expand validation. Keep all required final
   repository checks, CI, and hosted acceptance on the final source. Reuse
   exact-source evidence and rerun only checks invalidated by a change.
   Capture command arguments, working directory, actual exit status, separate
   output streams, relevant source identity, and review records through one
   tested project capture path when available. Keep failed results as failed.
   Do not rerun an expensive successful command only to improve its report.

## Schedule independent reviews

Treat the configured reviewer list as an ordering of prerequisites. Run every
required predecessor first. Once its prerequisites pass, independent
read-only reviewers may review the same frozen source concurrently when the
consuming project's ordering permits it and each configured quota pool has
reserved capacity. Reconcile shared pool usage and reserve all required
capacity before starting the batch. If a shared pool is unavailable, wait or
run only reviewers whose separate pools have capacity; never skip a reviewer
or exceed a pool.

Pin each invocation to its exact source and checkpoint. Record its unique task
or invocation ID, native result or result reference, assigned scope, selected
reviewer and model, and IDs of prior findings assigned for recheck. Keep
reviewer contexts isolated. Give each reviewer only its assigned input
and its own unresolved prior findings. Use the generated-input exception in
the reviewer contract for carried findings. Do not share one reviewer's
findings with another reviewer's initial independent assessment. Collect the
complete admitted batch before editing the source. If a later disposition
creates an unresolved objection for a reviewer, use the existing follow-up
review contract and record that invocation separately.

After any repair, apply the same scheduling rule to the affected review
coverage. Final readiness requires every mandatory reviewer to cover the
final head, with carry-forward only for unchanged scope whose recorded
identities and impact evidence still match.

## Carry review coverage

Pin every review result to the exact source, specification, generated-input
and output, rules/configuration, assigned reviewer, and selected model
identities, plus the scope it covered. After a repair, recheck every unresolved
finding with its assigned reviewer, preserve its ID, and record its updated
status and evidence. Review changed code and affected dependencies. Carry
unchanged coverage only when every recorded identity, assigned reviewer, and
selected model still match and the record names the covered scope and why the
change cannot affect it. A shared-analysis,
configuration, specification, dependency, or generation change invalidates
all coverage it can affect, including when the Git diff is empty. If impact is
uncertain, review that coverage again. For an empty-diff generated-input
change, use the input payload defined in [the reviewer contract](../../agentic-review/references/reviewer-contract.md).

Preserve every configured reviewer and its project-selected model and
authorization. A fresh independent reviewer is warranted when repeated related
findings show that the implementation or test strategy missed a category.
Give that reviewer only the pinned code for the missed category, applicable
approved-requirement excerpts, relevant prior findings for that category, and
a remit to find systemic gaps with concrete counterexamples. The owning
worker keeps edits and finding disposition. Do not use this review to bypass
reviewer configuration, quota, or phase control.

Incremental review applies during repair rounds. After each repair, validate
affected behavior and review changed code, affected dependencies, and carried
findings. Do not restart every reviewer after each repair when coverage remains
valid. Before readiness, account for every configured reviewer on the final
head. Each reviewer must cover changed and affected paths there; unchanged
coverage may carry only under the source, rule, reviewer, model, and scope
evidence above. Rerun missing or invalidated coverage, recheck all unresolved
findings, and pass all required repository checks and CI on that head. When
hosted review is configured, it must be accepted on the final head. Keep
additional consuming-project gates intact.
Report partial coverage as partial. See [agentic-review's coverage ledger](../../agentic-review/references/checkpoints-and-ledger.md)
for source and rule identity records.
