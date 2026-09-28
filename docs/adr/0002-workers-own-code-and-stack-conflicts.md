# Workers own code and stack conflicts

The coordinator schedules ticket workers, review capacity, stack admission, merge observation, and worktree cleanup. Ticket workers alone edit source code and resolve rebase conflicts, so a conflict stays with the worker that owns the ticket while the coordinator remains responsible for ordering and control-plane actions.
