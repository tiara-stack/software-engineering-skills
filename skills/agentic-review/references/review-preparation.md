# Review preparation and evidence

Use the maintained `scripts/review-prep.ts` helper when the consuming project
can provide its versioned input records and already has `tsx`, Effect's
`effect/unstable/cli`, and `@effect/platform-node`. This skill repo adds no
packages. The helper reads named local files and writes only to an explicit new
output path. It does not call reviewers, inspect remote PR state, send thread
messages, change coordinator state or quota, or remove files.

The consumer supplies a thin adapter from its canonical capture and receipt
files to the schemas below. Keep source capture receipts, accepted review
reports, and coordinator decisions in their existing canonical locations. Put
generated prompts and check outputs in a disposable directory that the assigned
reviewer can read. The helper validates local readability and hashes. The
adapter must still expose every referenced required file through the review
runtime's supported file or attachment mechanism.

## Prepare one reviewer input

Run the command once per independent axis:

```sh
pnpm exec tsx skills/agentic-review/scripts/review-prep.ts bundle \
  --input /path/to/review-plan.json \
  --axis correctness_reliability \
  --output /path/to/new-bundle-directory
```

The output directory must be new. The command writes `review-manifest.json`
and `reviewer-input.md` there.

`review-plan/v1` records the frozen source and an axis-specific review plan.
Every artifact reference has a label, a path relative to the plan, and a SHA-256
digest of its exact bytes. The helper copies the configured reviewer ID, model,
and reasoning effort unchanged. The source capture receipt uses this shape:

```json
{
  "schema": "review-source-capture/v1",
  "run_id": "example-run",
  "base": "<full commit ID>",
  "head": "<full frozen commit ID>",
  "capture_id": "capture-example",
  "deltas": {
    "correctness_reliability": {
      "sha256": "<digest of the axis delta file>",
      "changed_paths": ["src/owned.ts"]
    }
  }
}
```

The plan binds that receipt to the selected reviewer, delta, scope, coverage,
and readable inputs:

```json
{
  "schema": "review-plan/v1",
  "run_id": "example-run",
  "source": {
    "base": "<full commit ID>",
    "head": "<full frozen commit ID>",
    "capture_id": "capture-example",
    "capture_receipt": {
      "label": "source capture",
      "path": "capture/source.json",
      "sha256": "<digest>"
    }
  },
  "reviewers": {
    "correctness_reliability": {
      "reviewer": {
        "id": "<configured reviewer>",
        "model": "<configured model>",
        "reasoning_effort": "<configured reasoning effort>"
      },
      "delta": {"label": "correctness delta", "path": "capture/correctness.diff", "sha256": "<digest>"},
      "review_contract": {"label": "review contract", "path": "review-contract.md", "sha256": "<digest>"},
      "configuration": {"label": "review profile", "path": "reviewer-profile.json", "sha256": "<digest>"},
      "scope": {
        "paths": ["src/owned.ts"],
        "deleted_paths": [],
        "changed_paths": ["src/owned.ts"],
        "required_coverage": ["owned API behavior"],
        "included_coverage": ["owned API behavior"]
      },
      "source_files": [
        {"label": "src/owned.ts", "path": "src/owned.ts", "sha256": "<digest>"}
      ],
      "rules": [
        {"label": "ownership rule", "path": "docs/architecture.md", "sha256": "<digest>", "sections": ["Ownership"]}
      ],
      "requirements": [],
      "specification_identity": [],
      "generated_inputs": [],
      "dependencies": [],
      "prior_findings": [],
      "prior_coverage": []
    }
  }
}
```

Add one entry under `reviewers` for each configured axis. Add each axis's own
unresolved findings to its `prior_findings` list. A finding records its ID,
axis, `unresolved` status, original reviewer/model/reasoning effort, and a
readable finding-specific evidence reference. Keep that evidence separate from
the full multi-axis report. Inline report text is rejected, so the bundle never
copies a finding summary or another axis's report content. The helper rejects a
finding assigned to another axis or reviewer.

The `spec_conformance` axis includes raw requirements in `requirements` and
leaves `rules` and `specification_identity` empty. Risk axes include applicable
code-rule excerpts in `rules`, leave `requirements` empty, and put any
authoritative spec references needed only for invalidation in
`specification_identity`. The helper hashes those references for carry checks
but leaves them out of risk-review inputs. The adapter keeps issue text and raw
requirements out of risk-review inputs.

Each `prior_coverage` row names a canonical `review-coverage/v1` record with
`coverage_id`, prior `head`, `paths`, `coverage`, and the previous identity
fields below. The row repeats those fields so the helper can detect a mismatch.
It also includes `impact.status` (`unaffected`, `affected`, or `uncertain`), a
readable evidence reference whose content records the impact rationale.

```json
{
  "coverage_id": "coverage-owned-api",
  "head": "<previous full commit ID>",
  "paths": ["src/owned.ts"],
  "coverage": ["owned API behavior"],
  "identity": {
    "source_scope_sha256": "<digest>",
    "rules_sha256": "<digest>",
    "configuration_sha256": "<digest>",
    "specification_sha256": "<digest>",
    "generated_inputs_sha256": "<digest>",
    "dependencies_sha256": "<digest>",
    "reviewer_id": "<configured reviewer>",
    "model": "<configured model>",
    "reasoning_effort": "<configured reasoning effort>"
  },
  "record": {"label": "prior coverage", "path": "reports/coverage.json", "sha256": "<digest>"},
  "impact": {
    "status": "unaffected",
    "evidence": {"label": "impact evidence", "path": "reports/impact.json", "sha256": "<digest>"}
  }
}
```

The consuming adapter derives these records from the canonical completed
review ledger. For a coverage row, `source_scope_sha256` is SHA-256 over the
compact JSON array of `{path, sha256}` records for that exact scope, sorted by
path. Use the helper's emitted comparison hashes for rules, configuration,
specification, generated inputs, and dependencies. The helper checks that the
supplied row matches its canonical record. It does not decide whether the
reviewer accepted the scope or whether the impact rationale is sound.

The coordinator manifest reports `eligible_candidate` or `review_required` for
each row. A candidate is not a review result or a new-head pass. The coordinator
or worker still checks the impact evidence and decides whether unchanged
coverage can carry. The manifest is coordinator-only because it contains carry
decisions and evidence not needed for independent assessment. Give the reviewer
`reviewer-input.md` and only its listed artifacts. Do not pass the input plan or
coordinator manifest to a reviewer.

The helper rejects stale capture identities, file hash mismatches, unreadable
artifacts, incomplete coverage lists, axis leakage, reviewer inputs over 32 KiB,
and manifests over 64 KiB. It hashes each axis delta but does not decide whether
the adapter sliced it correctly or selected every relevant source path and
rule. The adapter derives those from the approved scope, repository
instructions, and dependency context. Before a native review start, confirm the
current branch or PR head still matches the captured head and recheck referenced
hashes. If any input changed, prepare a new bundle. The helper does not query
Git or the hosting service. It screens generated metadata for common credential
patterns but does not scan referenced file contents. Keep the pre-capture
secret review step and supply redacted, finding-specific evidence.

## Check a conditional grant

Use `check-grant` only for a grant already recorded and delivered by the
coordinator:

```sh
pnpm exec tsx skills/agentic-review/scripts/review-prep.ts check-grant \
  --input /path/to/conditional-grant.json \
  --output /path/to/new-grant-check.json
```

The `conditional-review-grant/v1` record names the exact grant, phase,
coordinator and worker IDs, base/head/capture ID, source-capture receipt,
required prerequisite receipt IDs, reservation ID and pool, required
invocation count, and native grant receipt. The referenced prerequisite files
use `review-prerequisite-receipt/v1` with `id`, `status: "passed"`, `head`, and
`capture_id`. The reservation file uses `review-quota-reservation/v1` with the
reservation and pool IDs, phase, head, coordinator ID, `status: "reserved"`,
and remaining reserved invocation count. The normalized
`conditional-review-grant-receipt/v1` binds the grant and source to its native
receipt. Its `native_receipt_identity` names the target worker, request ID,
delivery, and native result ID. The helper requires the target to match the
registered worker, the request ID to match `grant_id`, and the delivery to
match the receipt.

```json
{
  "schema": "conditional-review-grant/v1",
  "grant_id": "grant-example-review",
  "phase": "coordinated-review",
  "coordinator_thread_id": "<coordinator thread>",
  "worker_thread_id": "<worker thread>",
  "base": "<full commit ID>",
  "head": "<full frozen commit ID>",
  "capture_id": "capture-example",
  "required_invocations": 1,
  "required_prerequisite_ids": ["required-checks"],
  "capture_receipt": {"label": "capture", "path": "capture/source.json", "sha256": "<digest>"},
  "prerequisites": [{"id": "required-checks", "receipt": {"label": "checks", "path": "checks.json", "sha256": "<digest>"}}],
  "reservation": {"id": "reservation-example", "pool": "local-reviewer", "state_receipt": {"label": "reservation", "path": "reservation.json", "sha256": "<digest>"}},
  "grant_receipt": {"label": "native grant", "path": "grant-receipt.json", "sha256": "<digest>"}
}
```

The coordinator records real capacity under the existing shared lock before it
sends the conditional grant. The worker proceeds only when the native receipt,
source identity, every required prerequisite, and remaining reservation still
match. `reconcile` means the worker must return to the coordinator. This command
checks recorded inputs. It does not admit a phase, reserve capacity, or create a
grant. The consumer adapter must normalize its native receipt and reservation
record; the helper cannot read live coordinator state or prove who wrote a
local file. A `reconcile` result still writes the check file, then exits
nonzero so the worker stops at the phase boundary.

## Count actual starts

Use `count-starts` on normalized receipts captured from native reviewer starts:

```sh
pnpm exec tsx skills/agentic-review/scripts/review-prep.ts count-starts \
  --input /path/to/native-starts.json \
  --output /path/to/new-start-accounting.json
```

The input uses `review-native-starts/v1`, with the run, phase, base, head, and
start receipts. Each row names its expected axis, reviewer, model, and quota
pool. Its `review-native-start/v1` receipt records the same identity, the
accepted start status, and a readable reference to the original native receipt.
The helper rejects mismatches and counts each native start ID once. If a
backend provides no native ID, the adapter supplies a unique run-local
`invocation_id` and marks `native_id_available` false. Duplicate receipts for
that ID also count once.

```json
{
  "schema": "review-native-starts/v1",
  "run_id": "example-run",
  "phase": "coordinated-review",
  "base": "<full commit ID>",
  "head": "<full frozen commit ID>",
  "starts": [
    {
      "expected": {"axis": "correctness_reliability", "reviewer_id": "<configured reviewer>", "model": "<configured model>", "pool_id": "local-reviewer"},
      "receipt": {"label": "native start", "path": "starts/example-reviewer.json", "sha256": "<digest>"}
    }
  ]
}
```

The output is evidence for the coordinator to apply through its existing
quota-state lock. The command does not modify quota or turn failed reviews into
completed reviews.

## Summarize recorded time

Use `timing` with `review-timing/v1` events. Each event has an ID, one of
`preparation`, `service_wait`, `review`, `repair`, `validation`, or
`coordinator_wait`, plus actual ISO timestamps with a timezone offset:

```sh
pnpm exec tsx skills/agentic-review/scripts/review-prep.ts timing \
  --input /path/to/phase-times.json \
  --output /path/to/new-timing-summary.json
```

For example, a timed interval is
`{"id":"review-a","stage":"review","start_at":"2026-01-01T00:00:00Z","end_at":"2026-01-01T00:01:00Z"}`.
Set an unavailable timestamp to `null`. The summary merges overlapping
intervals within a stage and reports the union across stages, so concurrent
reviewers do not increase wall time twice. It lists unknown intervals and marks
partial results. Stage totals are not additive. The helper does not estimate
missing times or savings. An empty event list returns `no_recorded_intervals`.
