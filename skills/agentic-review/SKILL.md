---
name: agentic-review
description: Use when the user invokes `$agentic-review`, or when an explicitly invoked parent workflow selects it for incremental review. Review the changes since a caller-supplied base or the last completed checkpoint, and recheck carried findings. A generic code-review request follows the project's existing review workflow. Reading or mentioning this skill is context, not a request to run it.
---

# Agentic review

Run only after a direct `$agentic-review` invocation or a call from an explicitly invoked parent workflow that selected this review step. Reading, quoting, or discussing the skill does not start a review.

This skill reports findings only. Keep code, tests, Git branches, and pull requests unchanged. A parent workflow owns any fixes and follow-up runs.

## Review workflow

1. Read the repository's agent instructions and relevant domain context. For each changed path, follow applicable ancestor or nested agent instruction files, such as `AGENTS.md`, `CLAUDE.md`, or repository-specific instruction files. Follow their pointers to relevant coding, framework, architecture, or test guidance. Separate implementation rules from workflow instructions such as validation commands or issue handling; this review does not run those workflows. Confirm the caller requested this review path.
2. Find an authoritative spec from caller input first, then issue references in the reviewed commits or pull request, then matching files under the repository's spec or docs directories. Follow repository instructions for issue access. Use source text, not a summary or inferred requirements. If a referenced source cannot be accessed, report a spec-coverage gap and leave the run incomplete.
3. Read and validate the project's [reviewer configuration](references/configuration.md). Require all three core profiles, and require `spec_conformance` when a spec is found. Stop before checkpointing if a required field is missing, invalid, or still a placeholder.
4. Resolve the base and prior completed run. Use the latest completed checkpoint for this worktree and branch when one exists. Otherwise use the caller's base, or `HEAD` when none was supplied. Follow [checkpoint and ledger handling](references/checkpoints-and-ledger.md).
5. Inspect changed paths and content for likely secrets before capturing or dispatching review input. If it may contain a credential or other secret, stop and report the path without repeating the value.
6. Capture the Git checkpoint and compute the diff once. Read the prior completed run's ledger entry and route unresolved findings back to their original aspect reviewers.
7. If the diff is non-empty, start all three core reviewers in parallel, plus the spec reviewer when a spec is available. If the diff is empty but prior findings remain, start only the reviewers assigned those findings. Use the configured agent, model, and reasoning effort exactly. Start each reviewer with an isolated context and pass only its role-specific prompt; if the runtime cannot isolate reviewers, mark the run incomplete. If the runtime cannot launch a configured reviewer, mark that aspect unavailable rather than silently substituting another profile. Follow the [reviewer contract](references/reviewer-contract.md). Give risk reviewers the applicable code-rule excerpts with their source paths. Keep task specs and issue text out of risk-review prompts. Give the spec reviewer only the raw requirements and implementation diff. Do not pass the main agent's interpretation or other reviewers' findings to any reviewer.
8. Independently verify each proposed finding against the pinned diff and relevant code. Keep findings that meet the finding bar, merge only duplicate reports of the same underlying risk, and prepare the final report. A missing or failed required reviewer makes the run incomplete. Report available partial findings and leave the completed-checkpoint pointer unchanged.
9. After all required reviewers complete, save the report and carried-forward unresolved findings to the local text ledger, then advance the completed-checkpoint pointer. A run with no diff and no unresolved prior findings may complete with an explicit no-changes report and no reviewer dispatch.

## Review result

Report the base, checkpoint, coverage by aspect, findings, prior-finding rechecks, and review notes. Use severity, aspect, location, evidence, impact, and a concise suggested fix for each finding. Report `No findings.` when none meet the finding bar. Mark an incomplete run as incomplete even if no reviewer returned a finding. Do not add a numeric confidence score.

Use this format:

```markdown
## Agentic review

Base: <base>
Checkpoint: <checkpoint>
Status: complete|incomplete

### Coverage

- Correctness and reliability: complete|failed|skipped with reason
- Security and privacy: complete|failed|skipped with reason
- Maintainability and tests: complete|failed|skipped with reason
- Spec conformance: complete|skipped with reason|failed

### Findings

- None.

### Prior findings rechecked

- None.

### Review notes

- None.
```

When findings exist, group them under their aspect. Include `Aspects:` when one finding covers the same underlying risk reported by more than one reviewer.

The run is complete when its report is saved, every required reviewer completed, unresolved findings are recorded for the next run, and the completed-checkpoint pointer names the reviewed snapshot.
