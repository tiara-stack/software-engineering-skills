# Commit and submit

Use the repository's branch, commit-message, and submission conventions. The
examples below show Git's basic operations; a repository may require a branch
manager such as Graphite or a hosting CLI.

## Establish the working set

1. Run `git status --short` and mark the paths that belong to the request.
2. Keep unrelated new files untracked and unrelated edits unstaged. Stage
   explicit paths or hunks. Do not use a repository-wide add to sweep unrelated
   work into a commit.
3. When one file contains both related and unrelated edits, stage only the
   relevant hunks or stop and ask before changing that file.

The working set is ready when every intended path is known and unrelated work
is outside the index.

## Commit coherent slices

1. Finish one coherent feature slice and run its smallest relevant validation.
2. Confirm the target branch is checked out and is not the default branch.
   Follow the local commit-message convention. Stage only the slice:

   ```bash
   git add -- <path>...
   git commit -m "<project-conventional message>"
   ```

3. Inspect the commit and `git status --short`. Continue with the next slice.

Never discard commits or worktree changes to make branch setup easier. Avoid
destructive reset or clean operations while staging or grouping work.

## Submit

After the intended changes are committed and any selected local review is
complete, follow the repository's submission workflow. A repository without
a pull request or remote submission process is complete at its documented
local completion step. Do not invent a push or pull request. For a pull
request workflow, record its number, URL, and submitted head SHA. Submission
is complete when the intended branch has reached the remote and its review
target is known.
