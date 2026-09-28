# CodeRabbit local review

Use this procedure only when `coderabbit` is selected as a local reviewer.
Confirm the CLI is installed and resolve the actual target branch from
repository metadata.

Run the review against the complete branch diff, including new files. For a
CodeRabbit CLI that supports these flags:

```bash
coderabbit review --agent --base "$BASE" --include-untracked
```

Review every finding against the current code. Fix concrete correctness,
security, reliability, test, or maintainability defects in scope. Make a
preference change when it has clear value and low risk. After every repair,
follow the main workflow's rule to restart the complete local reviewer list
from its first entry. A prior finding is cleared only when it no longer
applies.

## Retry quota responses

A quota or rate-limit response is not a completed review. Read the wait
duration from the CLI message, wait that long, then rerun the same review
command against the same base and complete branch diff. If the CLI reports
another quota response with a usable duration, repeat the wait-and-retry loop.
Keep the issue status unchanged while waiting.

If the CLI gives no usable duration, including the literal `undefined`, wait
five minutes before retrying. If later quota responses still give no duration,
double the fallback wait after each response, up to 30 minutes. Keep retrying
until the review succeeds or a non-quota error occurs. Treat other failed
review commands as blockers, not as clean reviews. Follow
[Blockers and issue completion](../SKILL.md#blockers-and-issue-completion)
for tracker status when the route stops. If a finding remains after a genuine
repair attempt and no safe fix exists, report the blocker.
This review is complete when a successful CodeRabbit pass has no unresolved
actionable finding. A `local-review-loop` route is complete only after every
selected local reviewer has completed a clean pass.
