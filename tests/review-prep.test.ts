import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildTimingSummary,
  checkConditionalGrant,
  countNativeStarts,
  prepareReviewBundle,
  summarizeTiming,
} from "../skills/agentic-review/scripts/review-prep-core";

const BASE = "1".repeat(40);
const HEAD = "2".repeat(40);
const PRIOR_HEAD = "3".repeat(40);

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

async function fixtureDirectory(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "review-prep-test-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeJson(root: string, relativePath: string, value: unknown): Promise<{ label: string; path: string; sha256: string }> {
  const fullPath = path.join(root, relativePath);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return { label: relativePath, path: relativePath, sha256: hash(bytes) };
}

async function writeArtifact(root: string, relativePath: string, content: string): Promise<{ label: string; path: string; sha256: string }> {
  const fullPath = path.join(root, relativePath);
  const bytes = Buffer.from(content);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return { label: relativePath, path: relativePath, sha256: hash(bytes) };
}

async function reviewPlan(root: string, overrides: {
  captureHead?: string;
  includedCoverage?: Array<string>;
  missingSourceFile?: boolean;
  changePath?: string;
  previousDependenciesSha?: string;
  withSpec?: boolean;
} = {}): Promise<{ inputPath: string; otherAxisMarker: string }> {
  const otherAxisMarker = "SECURITY_AXIS_PRIVATE_BASELINE";
  const contract = await writeArtifact(root, "review-contract.md", "Report findings only. Keep each review isolated.\n");
  const rule = await writeArtifact(root, "rules/backend.md", "Use the repository's documented boundary rules.\n");
  const code = await writeArtifact(root, "src/owned.ts", "export const owned = true;\n");
  const delta = await writeArtifact(root, "captures/correctness.diff", "");
  const securityDelta = await writeArtifact(root, "captures/security.diff", "");
  const configuration = await writeArtifact(root, "profiles/correctness.json", "{\"id\":\"reviewer-a\"}\n");
  const securityConfiguration = await writeArtifact(root, "profiles/security.json", "{\"id\":\"reviewer-b\"}\n");
  const specification = overrides.withSpec
    ? await writeArtifact(root, "spec/requirements.md", "The ownership fields must match the resolved object.\n")
    : undefined;
  const specDelta = overrides.withSpec ? await writeArtifact(root, "captures/spec.diff", "") : undefined;
  const specConfiguration = overrides.withSpec
    ? await writeArtifact(root, "profiles/spec.json", "{\"id\":\"reviewer-spec\"}\n")
    : undefined;
  const findingEvidence = await writeArtifact(root, "reports/correctness-finding.md", "Prior evidence for this axis only.\n");
  const securityFindingEvidence = await writeArtifact(root, "reports/security-finding.md", otherAxisMarker);
  const impactEvidence = await writeArtifact(root, "reports/impact.md", "The recorded source scope is unchanged.\n");
  const capture = await writeJson(root, "captures/source-capture.json", {
    schema: "review-source-capture/v1",
    run_id: "run-fixture",
    base: BASE,
    head: overrides.captureHead ?? HEAD,
    capture_id: "capture-fixture",
    deltas: {
      correctness_reliability: {
        sha256: delta.sha256,
        changed_paths: overrides.changePath ? [overrides.changePath] : [],
      },
      security_privacy: { sha256: securityDelta.sha256, changed_paths: [] },
      ...(specification && specDelta ? { spec_conformance: { sha256: specDelta.sha256, changed_paths: [] } } : {}),
    },
  });
  const sourcePaths = overrides.missingSourceFile ? [] : [code];
  const expectedScopeHash = hash(JSON.stringify([{ path: "src/owned.ts", sha256: code.sha256 }]));
  const rulesHash = hash(JSON.stringify([{ label: rule.label, sha256: rule.sha256 }]));
  const emptyHash = hash("[]");
  const priorIdentity = {
    source_scope_sha256: expectedScopeHash,
    rules_sha256: rulesHash,
    configuration_sha256: configuration.sha256,
    specification_sha256: emptyHash,
    generated_inputs_sha256: emptyHash,
    dependencies_sha256: overrides.previousDependenciesSha ?? emptyHash,
    reviewer_id: "reviewer-a",
    model: "model-a",
    reasoning_effort: "high",
  };
  const priorRecord = await writeJson(root, "reports/prior-coverage.json", {
    schema: "review-coverage/v1",
    coverage_id: "coverage-owned-api",
    head: PRIOR_HEAD,
    paths: ["src/owned.ts"],
    coverage: ["owned API behavior"],
    identity: priorIdentity,
  });
  const plan = {
    schema: "review-plan/v1",
    run_id: "run-fixture",
    source: {
      base: BASE,
      head: HEAD,
      capture_id: "capture-fixture",
      capture_receipt: capture,
    },
    reviewers: {
      correctness_reliability: {
        reviewer: { id: "reviewer-a", model: "model-a", reasoning_effort: "high" },
        delta,
        review_contract: contract,
        configuration,
        scope: {
          paths: ["src/owned.ts"],
          deleted_paths: [],
          changed_paths: overrides.changePath ? [overrides.changePath] : [],
          required_coverage: ["owned API behavior"],
          included_coverage: overrides.includedCoverage ?? ["owned API behavior"],
        },
        source_files: sourcePaths,
        rules: [rule],
        requirements: [],
        specification_identity: specification ? [specification] : [],
        generated_inputs: [],
        dependencies: [],
        prior_findings: [
          {
            id: "AR-fixture-001",
            axis: "correctness_reliability",
            status: "unresolved",
            assigned_reviewer: { id: "reviewer-a", model: "model-a", reasoning_effort: "high" },
            evidence: findingEvidence,
          },
        ],
        prior_coverage: [
          {
            coverage_id: "coverage-owned-api",
            head: PRIOR_HEAD,
            paths: ["src/owned.ts"],
            coverage: ["owned API behavior"],
            identity: priorIdentity,
            record: priorRecord,
            impact: {
              status: "unaffected",
              evidence: impactEvidence,
            },
          },
        ],
      },
      security_privacy: {
        reviewer: { id: "reviewer-b", model: "model-b", reasoning_effort: "medium" },
        delta: securityDelta,
        review_contract: contract,
        configuration: securityConfiguration,
        scope: {
          paths: ["src/owned.ts"],
          deleted_paths: [],
          changed_paths: [],
          required_coverage: ["secret handling"],
          included_coverage: ["secret handling"],
        },
        source_files: [code],
        rules: [],
        requirements: [],
        specification_identity: specification ? [specification] : [],
        generated_inputs: [],
        dependencies: [],
        prior_findings: [
          {
          id: "AR-security-fixture-001",
            axis: "security_privacy",
            status: "unresolved",
            assigned_reviewer: { id: "reviewer-b", model: "model-b", reasoning_effort: "medium" },
            evidence: securityFindingEvidence,
          },
        ],
        prior_coverage: [],
      },
      ...(specification && specDelta && specConfiguration
        ? {
            spec_conformance: {
              reviewer: { id: "reviewer-spec", model: "model-spec", reasoning_effort: "high" },
              delta: specDelta,
              review_contract: contract,
              configuration: specConfiguration,
              scope: {
                paths: ["src/owned.ts"],
                deleted_paths: [],
                changed_paths: [],
                required_coverage: ["ownership requirement"],
                included_coverage: ["ownership requirement"],
              },
              source_files: [code],
              rules: [],
              requirements: [specification],
              specification_identity: [],
              generated_inputs: [],
              dependencies: [],
              prior_findings: [],
              prior_coverage: [],
            },
          }
        : {}),
    },
  };
  const planRef = await writeJson(root, "review-plan.json", plan);
  return { inputPath: path.join(root, planRef.path), otherAxisMarker };
}

test("bundle generation is deterministic and keeps reviewer axes isolated", async (t) => {
  const root = await fixtureDirectory(t);
  const { inputPath, otherAxisMarker } = await reviewPlan(root);
  const first = path.join(root, "output-a");
  const second = path.join(root, "output-b");
  const firstResult = await prepareReviewBundle({ inputPath, outputDirectory: first, axis: "correctness_reliability" });
  const secondResult = await prepareReviewBundle({ inputPath, outputDirectory: second, axis: "correctness_reliability" });
  const firstManifest = await readFile(firstResult.manifestPath, "utf8");
  const secondManifest = await readFile(secondResult.manifestPath, "utf8");
  const firstPrompt = await readFile(firstResult.reviewerInputPath, "utf8");
  const secondPrompt = await readFile(secondResult.reviewerInputPath, "utf8");

  assert.equal(firstManifest, secondManifest);
  assert.equal(firstPrompt, secondPrompt);
  assert.match(firstManifest, /"semantic_review_status": "not_evaluated"/u);
  assert.match(firstManifest, /"decision": "eligible_candidate"/u);
  assert.match(firstPrompt, /AR-fixture-001/u);
  assert.doesNotMatch(firstManifest, new RegExp(otherAxisMarker, "u"));
  assert.doesNotMatch(firstPrompt, new RegExp(otherAxisMarker, "u"));
  assert.doesNotMatch(firstPrompt, /security_privacy/u);
  assert.ok(firstResult.reviewerInputBytes < 32 * 1024);
});

test("bundle rejects stale capture identity, incomplete coverage, and missing source artifacts", async (t) => {
  const root = await fixtureDirectory(t);
  const staleRoot = path.join(root, "stale");
  await mkdir(staleRoot);
  const stale = await reviewPlan(staleRoot, { captureHead: PRIOR_HEAD });
  await assert.rejects(
    prepareReviewBundle({ inputPath: stale.inputPath, outputDirectory: path.join(staleRoot, "out"), axis: "correctness_reliability" }),
    /Stale source capture identity/u,
  );

  const coverageRoot = path.join(root, "coverage");
  await mkdir(coverageRoot);
  const coverage = await reviewPlan(coverageRoot, { includedCoverage: [] });
  await assert.rejects(
    prepareReviewBundle({ inputPath: coverage.inputPath, outputDirectory: path.join(coverageRoot, "out"), axis: "correctness_reliability" }),
    /Incomplete or unexpected coverage/u,
  );

  const missingRoot = path.join(root, "missing");
  await mkdir(missingRoot);
  const missing = await reviewPlan(missingRoot, { missingSourceFile: true });
  await assert.rejects(
    prepareReviewBundle({ inputPath: missing.inputPath, outputDirectory: path.join(missingRoot, "out"), axis: "correctness_reliability" }),
    /source_files must contain/u,
  );

  const missingFileRoot = path.join(root, "missing-file");
  await mkdir(missingFileRoot);
  const missingFile = await reviewPlan(missingFileRoot);
  const missingPlan = JSON.parse(await readFile(missingFile.inputPath, "utf8")) as {
    reviewers: { correctness_reliability: { source_files: Array<{ label: string; path: string; sha256: string }> } };
  };
  missingPlan.reviewers.correctness_reliability.source_files[0].path = "src/does-not-exist.ts";
  await writeFile(missingFile.inputPath, `${JSON.stringify(missingPlan, null, 2)}\n`);
  await assert.rejects(
    prepareReviewBundle({ inputPath: missingFile.inputPath, outputDirectory: path.join(missingFileRoot, "out"), axis: "correctness_reliability" }),
    /missing or unreadable/u,
  );

  const staleArtifactRoot = path.join(root, "stale-artifact");
  await mkdir(staleArtifactRoot);
  const staleArtifact = await reviewPlan(staleArtifactRoot);
  await writeFile(path.join(staleArtifactRoot, "src/owned.ts"), "export const owned = false;\n");
  await assert.rejects(
    prepareReviewBundle({ inputPath: staleArtifact.inputPath, outputDirectory: path.join(staleArtifactRoot, "out"), axis: "correctness_reliability" }),
    /SHA-256 mismatch/u,
  );
});

test("carry candidates require unchanged inputs and scope evidence", async (t) => {
  const root = await fixtureDirectory(t);
  const sourcePath = await reviewPlan(root, { changePath: "src/owned.ts" });
  const output = path.join(root, "output");
  await prepareReviewBundle({ inputPath: sourcePath.inputPath, outputDirectory: output, axis: "correctness_reliability" });
  const manifest = JSON.parse(await readFile(path.join(output, "review-manifest.json"), "utf8")) as {
    coordinator_only: { carry_candidates: Array<{ decision: string; reasons: Array<string>; semantic_approval: boolean }> };
  };
  const [candidate] = manifest.coordinator_only.carry_candidates;
  assert.equal(candidate.decision, "review_required");
  assert.ok(candidate.reasons.includes("changed_path_intersects_scope"));
  assert.equal(candidate.semantic_approval, false);

  const changedInputRoot = path.join(root, "changed-input");
  await mkdir(changedInputRoot);
  const changedInput = await reviewPlan(changedInputRoot, { previousDependenciesSha: hash("prior-dependency-set") });
  const changedOutput = path.join(changedInputRoot, "output");
  await prepareReviewBundle({ inputPath: changedInput.inputPath, outputDirectory: changedOutput, axis: "correctness_reliability" });
  const changedManifest = JSON.parse(await readFile(path.join(changedOutput, "review-manifest.json"), "utf8")) as {
    coordinator_only: { carry_candidates: Array<{ decision: string; reasons: Array<string> }> };
  };
  const [changedCandidate] = changedManifest.coordinator_only.carry_candidates;
  assert.equal(changedCandidate.decision, "review_required");
  assert.ok(changedCandidate.reasons.includes("dependencies_changed"));
});

test("bundle refuses inline prior report text", async (t) => {
  const root = await fixtureDirectory(t);
  const fixture = await reviewPlan(root);
  const plan = JSON.parse(await readFile(fixture.inputPath, "utf8")) as {
    reviewers: { correctness_reliability: { prior_findings: Array<{ summary: string }> } };
  };
  plan.reviewers.correctness_reliability.prior_findings[0].summary = `token: \"ghp_${"A".repeat(36)}\"`;
  await writeFile(fixture.inputPath, `${JSON.stringify(plan, null, 2)}\n`);
  await assert.rejects(
    prepareReviewBundle({ inputPath: fixture.inputPath, outputDirectory: path.join(root, "out"), axis: "correctness_reliability" }),
    /axis-specific evidence reference instead of inline report text/u,
  );
});

test("bundle refuses credential-shaped inline metadata", async (t) => {
  const root = await fixtureDirectory(t);
  const fixture = await reviewPlan(root);
  const plan = JSON.parse(await readFile(fixture.inputPath, "utf8")) as {
    reviewers: { correctness_reliability: { prior_findings: Array<{ evidence: { label: string } }> } };
  };
  plan.reviewers.correctness_reliability.prior_findings[0].evidence.label = `ghp_${"A".repeat(36)}`;
  await writeFile(fixture.inputPath, `${JSON.stringify(plan, null, 2)}\n`);
  await assert.rejects(
    prepareReviewBundle({ inputPath: fixture.inputPath, outputDirectory: path.join(root, "out"), axis: "correctness_reliability" }),
    /common credential pattern/u,
  );
});

test("risk reviewers compare spec identity without receiving spec files", async (t) => {
  const root = await fixtureDirectory(t);
  const fixture = await reviewPlan(root, { withSpec: true });
  const riskOutput = path.join(root, "risk-output");
  await prepareReviewBundle({ inputPath: fixture.inputPath, outputDirectory: riskOutput, axis: "correctness_reliability" });
  const riskPrompt = await readFile(path.join(riskOutput, "reviewer-input.md"), "utf8");
  const riskManifest = JSON.parse(await readFile(path.join(riskOutput, "review-manifest.json"), "utf8")) as {
    coordinator_only: { carry_candidates: Array<{ reasons: Array<string> }> };
  };
  assert.doesNotMatch(riskPrompt, /spec\/requirements\.md/u);
  assert.ok(riskManifest.coordinator_only.carry_candidates[0].reasons.includes("specification_changed"));

  const specOutput = path.join(root, "spec-output");
  await prepareReviewBundle({ inputPath: fixture.inputPath, outputDirectory: specOutput, axis: "spec_conformance" });
  const specPrompt = await readFile(path.join(specOutput, "reviewer-input.md"), "utf8");
  assert.match(specPrompt, /spec\/requirements\.md/u);
  assert.doesNotMatch(specPrompt, /rules\/backend\.md/u);
});

async function grantFixture(root: string, options: { sourceHead?: string; grantTarget?: string } = {}): Promise<{ inputPath: string; statePath: string }> {
  const base = BASE;
  const head = HEAD;
  const capture = await writeJson(root, "capture.json", {
    schema: "review-source-capture/v1",
    run_id: "run-fixture",
    base,
    head: options.sourceHead ?? head,
    capture_id: "capture-fixture",
    deltas: {},
  });
  const prerequisite = await writeJson(root, "prerequisite.json", {
    schema: "review-prerequisite-receipt/v1",
    id: "required-checks",
    status: "passed",
    head,
    capture_id: "capture-fixture",
  });
  const state = await writeJson(root, "reservation.json", {
    schema: "review-quota-reservation/v1",
    reservation_id: "reserve-1",
    pool: "local-reviewer",
    phase: "coordinated-review",
    head,
    coordinator_thread_id: "coordinator-1",
    status: "reserved",
    remaining_invocations: 1,
  });
  const nativeReceipt = await writeJson(root, "native-grant.json", { accepted: true, message_id: "grant-message" });
  const grant = await writeJson(root, "grant.json", {
    schema: "conditional-review-grant-receipt/v1",
    grant_id: "grant-1",
    phase: "coordinated-review",
    coordinator_thread_id: "coordinator-1",
    worker_thread_id: options.grantTarget ?? "worker-1",
    head,
    capture_id: "capture-fixture",
    reservation_ids: ["reserve-1"],
    delivery: "queued",
    native_receipt_identity: {
      target_worker_id: options.grantTarget ?? "worker-1",
      request_id: "grant-1",
      delivery: "queued",
      native_result_id: "message-1",
    },
    native_receipt: nativeReceipt,
  });
  const input = await writeJson(root, "conditional-input.json", {
    schema: "conditional-review-grant/v1",
    grant_id: "grant-1",
    phase: "coordinated-review",
    coordinator_thread_id: "coordinator-1",
    worker_thread_id: "worker-1",
    base,
    head,
    capture_id: "capture-fixture",
    required_invocations: 1,
    capture_receipt: capture,
    required_prerequisite_ids: ["required-checks"],
    prerequisites: [{ id: "required-checks", receipt: prerequisite }],
    reservation: { id: "reserve-1", pool: "local-reviewer", state_receipt: state },
    grant_receipt: grant,
  });
  return { inputPath: path.join(root, input.path), statePath: path.join(root, state.path) };
}

test("conditional grants require matching source, prerequisites, reservation, and native receipt", async (t) => {
  const root = await fixtureDirectory(t);
  const fixture = await grantFixture(root);
  const before = await readFile(fixture.statePath);
  const result = await checkConditionalGrant({ inputPath: fixture.inputPath, outputPath: path.join(root, "grant-check.json") });
  const after = await readFile(fixture.statePath);
  assert.equal(result.status, "predicates_satisfied");
  assert.deepEqual(after, before);
  const output = JSON.parse(await readFile(result.outputPath, "utf8")) as { grants_capacity: boolean; performs_native_start: boolean };
  assert.equal(output.grants_capacity, false);
  assert.equal(output.performs_native_start, false);

  const staleRoot = path.join(root, "stale-grant");
  await mkdir(staleRoot);
  const stale = await grantFixture(staleRoot, { sourceHead: PRIOR_HEAD });
  const staleResult = await checkConditionalGrant({ inputPath: stale.inputPath, outputPath: path.join(staleRoot, "grant-check.json") });
  assert.equal(staleResult.status, "reconcile");
  assert.ok(staleResult.checks.some((check) => check.id === "frozen_source" && check.passed === false));

  const wrongTargetRoot = path.join(root, "wrong-target");
  await mkdir(wrongTargetRoot);
  const wrongTarget = await grantFixture(wrongTargetRoot, { grantTarget: "worker-elsewhere" });
  const wrongTargetResult = await checkConditionalGrant({ inputPath: wrongTarget.inputPath, outputPath: path.join(wrongTargetRoot, "grant-check.json") });
  assert.equal(wrongTargetResult.status, "reconcile");
  assert.ok(wrongTargetResult.checks.some((check) => check.id === "native_grant_receipt" && check.passed === false));
});

test("native start receipts count each actual start ID once", async (t) => {
  const root = await fixtureDirectory(t);
  const start = {
    schema: "review-native-start/v1",
    native_start_id: "native-run-1",
    run_id: "run-fixture",
    phase: "coordinated-review",
    base: BASE,
    head: HEAD,
    axis: "correctness_reliability",
    reviewer_id: "reviewer-a",
    model: "model-a",
    pool_id: "local-reviewer",
    status: "started",
    native_id_available: true,
  };
  const nativeReceipt = await writeArtifact(root, "native/native-start.json", "{\"accepted\":true,\"request_id\":\"native-run-1\"}\n");
  const startWithReceipt = { ...start, native_receipt: nativeReceipt };
  const first = await writeJson(root, "start-one.json", startWithReceipt);
  const second = await writeJson(root, "start-two.json", startWithReceipt);
  const input = await writeJson(root, "starts.json", {
    schema: "review-native-starts/v1",
    run_id: "run-fixture",
    phase: "coordinated-review",
    base: BASE,
    head: HEAD,
    starts: [
      { expected: { axis: "correctness_reliability", reviewer_id: "reviewer-a", model: "model-a", pool_id: "local-reviewer" }, receipt: first },
      { expected: { axis: "correctness_reliability", reviewer_id: "reviewer-a", model: "model-a", pool_id: "local-reviewer" }, receipt: second },
    ],
  });
  const result = await countNativeStarts({ inputPath: path.join(root, input.path), outputPath: path.join(root, "starts-accounted.json") });
  assert.equal(result.uniqueStarts, 1);
  assert.equal(result.duplicateReceipts, 1);
  const output = JSON.parse(await readFile(result.outputPath, "utf8")) as { mutates_quota_state: boolean; unique_start_count: number };
  assert.equal(output.mutates_quota_state, false);
  assert.equal(output.unique_start_count, 1);

  const fallbackStart = { ...startWithReceipt, native_id_available: false, native_start_id: undefined, invocation_id: "run-fixture-reviewer-a-1" };
  const fallbackOne = await writeJson(root, "fallback-start-one.json", fallbackStart);
  const fallbackTwo = await writeJson(root, "fallback-start-two.json", fallbackStart);
  const fallbackInput = await writeJson(root, "fallback-starts.json", {
    schema: "review-native-starts/v1",
    run_id: "run-fixture",
    phase: "coordinated-review",
    base: BASE,
    head: HEAD,
    starts: [
      { expected: { axis: "correctness_reliability", reviewer_id: "reviewer-a", model: "model-a", pool_id: "local-reviewer" }, receipt: fallbackOne },
      { expected: { axis: "correctness_reliability", reviewer_id: "reviewer-a", model: "model-a", pool_id: "local-reviewer" }, receipt: fallbackTwo },
    ],
  });
  const fallbackResult = await countNativeStarts({ inputPath: path.join(root, fallbackInput.path), outputPath: path.join(root, "fallback-accounted.json") });
  assert.equal(fallbackResult.uniqueStarts, 1);
  assert.equal(fallbackResult.duplicateReceipts, 1);
  const fallbackOutput = JSON.parse(await readFile(fallbackResult.outputPath, "utf8")) as {
    unique_starts: Array<{ native_id_available: boolean; invocation_id: string }>;
  };
  assert.equal(fallbackOutput.unique_starts[0].native_id_available, false);
  assert.equal(fallbackOutput.unique_starts[0].invocation_id, "run-fixture-reviewer-a-1");
});

test("timing merges overlap, excludes concurrency from wall time, and marks unknown intervals", async (t) => {
  assert.equal(summarizeTiming({ schema: "review-timing/v1", events: [] }).status, "no_recorded_intervals");
  const summary = summarizeTiming({
    schema: "review-timing/v1",
    events: [
      { id: "prepare", stage: "preparation", start_at: "2026-01-01T00:00:00Z", end_at: "2026-01-01T00:10:00Z" },
      { id: "review-a", stage: "review", start_at: "2026-01-01T00:10:00Z", end_at: "2026-01-01T00:30:00Z" },
      { id: "review-b", stage: "review", start_at: "2026-01-01T00:12:00Z", end_at: "2026-01-01T00:22:00Z" },
      { id: "validation", stage: "validation", start_at: "2026-01-01T00:25:00Z", end_at: "2026-01-01T00:40:00Z" },
      { id: "service-wait", stage: "service_wait", start_at: "2026-01-01T00:30:00Z", end_at: "2026-01-01T00:50:00Z" },
      { id: "coordinator-wait", stage: "coordinator_wait", start_at: "2026-01-01T00:50:00Z", end_at: null },
    ],
  });
  const stages = summary.intervals_by_stage_seconds as Record<string, number>;
  assert.equal(stages.review, 1200);
  assert.equal(summary.known_interval_union_seconds, 3000);
  assert.equal(summary.concurrent_time_excluded_seconds, 900);
  assert.equal(summary.elapsed_span_seconds, 3000);
  assert.equal(summary.status, "partial_unknown_timestamps");
  assert.equal(summary.no_estimates_used, true);

  const root = await fixtureDirectory(t);
  const input = await writeJson(root, "timing.json", {
    schema: "review-timing/v1",
    events: [{ id: "unknown", stage: "repair", start_at: null, end_at: null }],
  });
  const output = await buildTimingSummary({ inputPath: path.join(root, input.path), outputPath: path.join(root, "timing-summary.json") });
  assert.equal(output.summary.status, "partial_unknown_timestamps");
});
