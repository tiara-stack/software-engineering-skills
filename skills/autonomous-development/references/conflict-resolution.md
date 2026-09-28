# Conflict resolution

Use Matt Pocock's `resolving-merge-conflicts` skill whenever it is installed.
This procedure follows the same hunk-by-hunk method when that skill is
unavailable, and adds the pull request checks this workflow needs. Use it when
Git has unmerged paths, a merge or rebase stops with conflicts, or the hosting
platform says a pull request conflicts with its target branch.

1. See the current state. Read `git status --short`, Git history, and the
   conflicting files. Inspect unmerged paths with `git ls-files -u`, identify
   the current branch and target, and check whether a merge or rebase is
   already in progress. For a pull request, read its current head and target
   branch from the hosting platform. Follow the repository's branch manager
   and merge or rebase convention.
2. Find the primary source for each side's intent. Read commit messages, pull
   request discussion, the originating issue or specification, and relevant
   code and tests.
3. Resolve every task-owned hunk. Preserve both intents where possible. When
   they are incompatible, choose the behavior that matches the operation's
   stated goal and record the trade-off. Do not invent behavior. Continue the
   existing merge or rebase until it finishes; never abort it. Stage only
   resolved paths to preserve unrelated working changes.
4. Discover and run the repository's required automated checks. Fix any
   failures caused by the resolution, then inspect the resulting diff. Confirm
   `git ls-files -u` returns no paths and no merge or rebase remains in
   progress.
5. Finish the operation according to the repository's convention. Commit the
   merge or resolved rebase, continuing a rebase until every commit is
   rebased. For a pull request, submit the new head, confirm the host reports
   it conflict-free with the target, then rerun required checks and hosted
   review for that head.

Do not resolve unrelated user work as a side effect. If a conflict includes
paths outside the selected task and cannot be separated safely, preserve the
worktree and report the blocker with the affected paths.
