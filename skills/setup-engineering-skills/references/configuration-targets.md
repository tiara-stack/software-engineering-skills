# Configuration targets

Use a path named in the repository's root instructions when one exists. Otherwise use the default paths below.

## Autonomous development

Keep branch, commit, validation, review, CI, tracker, and submission conventions
in the existing root instruction file or its linked docs.

The optional `.agents/autonomous-development.yaml` can contain
`local_reviewers`, `open_code_review`, and `merge_label`. `local_reviewers` is
an ordered list of reviewer identifiers. The built-ins are `agentic-review`,
`coderabbit`, and `open-code-review`.
Other identifiers require repository instructions that describe the review
invocation, review scope, completion signal, and failure handling. An absent
list falls back to explicit repository review
instructions; tool installation alone does not select a reviewer. A present
empty list selects no local reviewer. The `agentic-review` entry requires the
installed skill and complete reviewer profiles. Set `merge_label` only to an
existing repository label.

`open-code-review` requires a separately installed Open Code Review `ocr`
CLI. Its optional `open_code_review.mode` accepts `managed` or `delegation`
and defaults to `managed`; it applies only when that reviewer is selected.
When ticket coordination is configured, include each selected local reviewer
in a local quota pool.

The former `agentic_review: true` setting selected Agentic Review before
CodeRabbit. Migrate it to `local_reviewers: [agentic-review, coderabbit]`.
A former false value maps to `local_reviewers: [coderabbit]` when repository
evidence shows that the project used local review. Otherwise omit the list.

The `merge_label` value must match an existing repository label. Never create a
label or guess a replacement.

When a selected workflow needs issue-tracker operations, read the configured tracker doc. The default path is `docs/agents/issue-tracker.md`. It should tell the skills where issues live and how to create, read, list, comment on, and update them. Record any local fallback or unavailable-tracker behavior the workflow needs.

## Agentic review

The default path is `.agents/agentic-review.yaml`. Use version `1` and define these profiles under `reviewers`:

- `correctness_reliability`
- `security_privacy`
- `maintainability_tests`
- `spec_conformance`

Each profile has non-empty string fields `coding_agent`, `model`, and `reasoning_effort`. The review skill requires the first three profiles and requires `spec_conformance` when an authoritative spec is available. Use the selected config's default for `spec_conformance` too, so the profile is ready when a spec appears. Keep per-profile overrides exactly as approved.

## Ticket agent routing

The default path is `.agents/ticket-routing.yaml`. Use version `1` and define all five levels under `levels`: `quick`, `focused`, `standard`, `complex`, and `architectural`. Each level has non-empty string fields `coding_agent`, `model`, and `reasoning_effort`.

## Ticket coordination

The default path is `.agents/ticket-coordinator.yaml`. Use version `1` and
select `worker_backend` as `subagent`, `t3code-mcp`, or
`t3code-orchestrator-v2`. See the [T3Code Orchestrator V2 protocol](../../ticket-coordinator/references/t3code-orchestrator-v2.md)
for its complete pre-dispatch checks. `max_workers` defaults to 2. Set
`stack_backend` to the consuming project's configured stack tool, or omit it
only when root instructions identify exactly one supported tool.

Define `review_pools` separately for local and hosted reviewers. Each pool
lists its reviewer identifiers and may set `max_active` (default 1) plus an
optional `rolling_window` with `max_invocations` and `window_seconds`. Omit
unknown rolling limits; the coordinator still serializes active loops and
honors provider cooldowns. The coordinator's quota state lives outside worker
worktrees and is shared by runs in the consuming repository.

When Matt Pocock's `$implement` is installed, include its `/code-review` step
in a local pool. Run the full test suite once after stack rebase and review
repairs, before merge-label admission.

The coordinator depends on the `autonomous-development` skill for its
coordinated worker routes. Configure both workflows together. The configured
`merge_label` must be an existing repository label that project instructions
identify as merge-queue admission.

## Existing project docs

If `docs/agents/issue-tracker.md` or other `docs/agents/*.md` files already exist, read and reuse them as repository configuration. They may have been created by `setup-matt-pocock-skills` or another workflow. Their presence does not call for running that skill. Preserve unrelated tracker, triage-label, and domain-doc settings.
