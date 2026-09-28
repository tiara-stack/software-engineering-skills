# Use Git checkpoints and a local text ledger for agentic review

Agentic review uses Git refs for source snapshots and text reports under Git metadata to track completed runs and unresolved findings. This keeps incremental review available without a database or generated dependency graph, at the cost of keeping review history local to a worktree rather than querying it across clones.
