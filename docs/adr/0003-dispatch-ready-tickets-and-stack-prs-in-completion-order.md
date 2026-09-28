# Dispatch ready tickets and stack PRs in completion order

The coordinator dispatches a ticket only after every blocking PR has merged, then starts all newly eligible tickets in parallel. Workers' implementation handoffs determine stack order; each worker rebases its branch onto the current stack tip and resolves conflicts before the coordinator admits its PR. A conflict at the head holds later admissions. Runs resume by reconciling tracker, PR stack, and worktree state; cleanup follows confirmed merge and preserves the branch.
