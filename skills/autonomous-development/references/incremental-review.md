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
4. Run focused checks, then every required project check on the changed head.
   Capture command arguments, working directory, actual exit status, separate
   output streams, relevant source identity, and review records through one
   tested project capture path when available. Keep failed results as failed.
   Do not rerun an expensive successful command only to improve its report.

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

Incremental progress is not acceptance. Before readiness, run a complete final
branch review with every configured reviewer on the exact final source/head,
recheck all unresolved findings, and pass all required checks on that head.
Report partial coverage as partial. See [agentic-review's coverage ledger](../../agentic-review/references/checkpoints-and-ledger.md)
for source and rule identity records.
