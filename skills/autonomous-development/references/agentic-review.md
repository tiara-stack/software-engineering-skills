# Agentic Review integration

Use this procedure when `agentic-review` is selected as a local reviewer in
`.agents/autonomous-development.yaml` or in repository instructions.

## Preflight

Before the first repository mutation, confirm the `agentic-review` skill is
available. Resolve the task's authoritative spec during intake, then follow
the review skill's reviewer-configuration guidance and the consuming project's
configured path. Validate all required profiles, including
`spec_conformance` when an authoritative spec is available. If the skill or a
required setting is missing or invalid, report the exact gap and stop before
code edits, issue claims, or branch changes.

## Run

1. Invoke `agentic-review` on the current branch. When it has no completed
   checkpoint, pass the same review base used by the other local reviewers.
   Later runs use its latest completed checkpoint for the worktree and branch.
2. Verify each reported finding against the current code. The parent workflow
   owns repairs, validation, and commits.
3. After a repair, rerun affected coverage and unresolved finding checks. Use
   [incremental review](incremental-review.md) to carry unchanged coverage
   only with matching source/rule identity and scope evidence. Keep the route
   open when review is incomplete or a valid finding has no safe repair.
