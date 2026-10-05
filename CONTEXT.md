# Agentic Engineering Workflows

Language for the reusable engineering workflows in this repository and the project-level setup they rely on.

## Language

**Consuming project**:
A repository where one or more engineering skills run and whose local conventions and settings those skills use.

**Selected workflow**:
A skill the consuming project intends to use and wants configured. Installation alone does not make a workflow selected.

**Coordinator**:
The agent that schedules ticket workers, controls review capacity and stack admission, observes PR merges, and removes merged worktrees without editing source code.

**Ticket worker**:
An agent assigned one work ticket that owns its implementation, stack rebase conflicts, and review repairs until its PR is ready for merge-label admission.

**Coordinator run**:
A resumable orchestration of one approved spec and its ticket set. On resume, the coordinator reconciles tracker, PR stack, and worktree state before acting.

**Coordinated mode**:
A run of autonomous-development where a worker pauses after implementation, resumes after its branch is admitted to the PR stack, and stops before merge-label admission.

**Workflow blocker**:
A condition that prevents a selected workflow from reaching its terminal criterion. It pauses the workflow without changing the issue's tracker status.

**Ticket dependency**:
A `Blocked by` relationship that makes a ticket dispatchable only after every blocking issue's pull request has merged. Merging one blocker may make several tickets dispatchable at once.

**Review run**:
One bounded assessment of a specific repository state by its configured reviewers.

**Local reviewer**:
A procedure selected by a consuming project to assess branch changes outside the pull request host.

**Hosted reviewer**:
A reviewer configured on a pull request hosting platform. Its selection is independent of local reviewers.

**Checkpoint**:
A stable reference to a repository state that marks what a review run assessed.

**Incremental review**:
An assessment of changes since the previous completed checkpoint for the same worktree and branch, with unresolved findings rechecked.

**Agentic review loop**:
A sequence of review runs and repairs that ends when the current changes have no unresolved actionable findings.

**Review quota pool**:
A rolling-window allowance and concurrency limit for a local or hosted reviewer account. Local capacity is reserved only during local review; hosted capacity is reserved from the project's hosted-review trigger, usually undraft, through the merge label, including local review retries during that hosted cycle.

**Review base**:
The repository state from which a run determines the changes under review.

**Review ledger**:
The history of completed review runs and the unresolved findings carried forward between them.

**Review aspect**:
A bounded risk lens assigned to a reviewer. The aspects are correctness and reliability, security and privacy, and maintainability and tests.
_Avoid_: Review category

**Stacked PR**:
A pull request based on another unmerged pull request, forming an ordered dependency chain. Ticket implementation may run in parallel, while integration into the chain proceeds in order.

**Stack admission**:
Adding a PR as the next stack layer after its worker rebases the branch onto the current stack tip, resolves conflicts, and confirms it is ready. The coordinator admits it without editing code.

**Stack order**:
PRs in one run enter the stack in the order their workers report implementation complete.

**Merge label**:
The configured pull request label that admits a reviewed PR to the repository's merge queue.

**Project convention**:
A repository-documented rule that governs how implementation, architecture, or tests should be written.

**Spec reviewer**:
The reviewer that checks a change against authoritative requirements. It receives the raw spec; other reviewers do not receive the spec or the main agent's interpretation.

**Finding**:
An evidence-backed, actionable risk tied to the reviewed change, with material impact, severity, and a code location when available. Style preferences, speculative concerns, and low-impact nits do not qualify; a reviewer may return no findings.
