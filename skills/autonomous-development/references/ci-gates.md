# CI gates

Use this reference for `pre-undraft`, `undraft`, `pre-merge`, `babysit`, and
`merge`, and for `implement` when the repository's submission workflow uses a
pull request. The repository and hosting platform define which checks are
required. Read their workflow files and branch-protection settings. Do not
substitute a convenient green job for the complete required-check set.

## Poll the submitted head

Use the hosting platform's CLI or API to watch the required checks for the
submitted commit. Keep the pull request identity and head SHA for every poll.
On GitHub, `gh pr checks <PR> --required --watch` is one available path. Use
the equivalent documented operation for another host.

A successful gate requires every required check to report success for the
current head. Missing checks, failed or cancelled checks, pending checks at
timeout, and failed status queries keep the gate open or blocked. Treat command
and authentication errors as polling blockers, not as check results.

Before reporting a terminal result, read the pull request's current head again.
If it changed, poll the new head. If the host cannot confirm the head, report a
head-validation blocker and do not call the older result green.

## Repair a failure

1. Retry a failure once only when evidence points to a transient service or
   infrastructure problem. Reproduce a repository-owned failure using the
   command and versions defined by the project's CI configuration.
2. Fix the code, test, or configuration that caused a repository-owned
   failure. Change a baseline only when the code intentionally changes the
   measured result and local validation confirms that change.
3. Check whether the pull request conflicts with its target branch. Resolve
   every task-owned conflict by following
   [Conflict resolution](conflict-resolution.md). After resolving it, continue
   through the repair and resubmission steps below.
4. Run focused checks and affected review coverage after repair. Follow
   [incremental review](incremental-review.md). If no local reviewer is
   selected, skip local review. Commit the repair, submit a new head, and poll
   that head from the start. Final readiness still requires complete configured
   reviewer coverage on the final source/head, carrying unchanged scope only
   when the incremental-review evidence still applies.

Keep repairs and repository decisions with the main agent. A polling helper may
report check states, but it does not diagnose, edit, commit, submit, undraft,
label, or comment.
