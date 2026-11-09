import { createHash } from "node:crypto";
import path from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
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

/** Runs a fixture test with the Node-backed Effect filesystem services. */
function reviewTest(name: string, run: () => Effect.Effect<void, any, any>): void {
  it.effect(name, () => run().pipe(Effect.provide(NodeServices.layer)));
}

/** Creates a fixture directory that is removed when its Effect test scope closes. */
function fixtureDirectory() {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.makeTempDirectoryScoped({ prefix: "review-prep-test-" });
  });
}

/** Writes formatted JSON and returns a reference to the exact bytes written. */
function writeJson(root: string, relativePath: string, value: unknown) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const fullPath = path.join(root, relativePath);
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    yield* fs.makeDirectory(path.dirname(fullPath), { recursive: true });
    yield* fs.writeFile(fullPath, bytes);
    return { label: relativePath, path: relativePath, sha256: hash(bytes) };
  });
}

/** Writes a text artifact and returns its byte identity for review fixtures. */
function writeArtifact(root: string, relativePath: string, content: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const fullPath = path.join(root, relativePath);
    const bytes = Buffer.from(content);
    yield* fs.makeDirectory(path.dirname(fullPath), { recursive: true });
    yield* fs.writeFile(fullPath, bytes);
    return { label: relativePath, path: relativePath, sha256: hash(bytes) };
  });
}

/** Reads a fixture as UTF-8 through the Effect filesystem service. */
function readText(filePath: string) {
  return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(filePath));
}

/** Reads fixture bytes through the Effect filesystem service. */
function readBytes(filePath: string) {
  return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFile(filePath));
}

/** Overwrites a fixture file with UTF-8 text through the Effect filesystem. */
function writeText(filePath: string, content: string) {
  return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(filePath, content));
}

/** Creates a fixture directory recursively through the Effect filesystem. */
function makeDirectory(directoryPath: string) {
  return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeDirectory(directoryPath, { recursive: true }));
}

/** Builds source captures, axis inputs, and prior evidence for bundle tests. */
function reviewPlan(
  root: string,
  overrides: {
    captureHead?: string;
    includedCoverage?: Array<string>;
    missingSourceFile?: boolean;
    changePath?: string;
    previousDependenciesSha?: string;
    withSpec?: boolean;
  } = {},
) {
  return Effect.gen(function* () {
    const otherAxisMarker = "SECURITY_AXIS_PRIVATE_BASELINE";
    const contract = yield* writeArtifact(
      root,
      "review-contract.md",
      "Report findings only. Keep each review isolated.\n",
    );
    const rule = yield* writeArtifact(root, "rules/backend.md", "Use the repository's documented boundary rules.\n");
    const mixedCaseRule = yield* writeArtifact(
      root,
      "rules/a-backend.md",
      "Keep rule identity ordering locale independent.\n",
    );
    const code = yield* writeArtifact(root, "src/owned.ts", "export const owned = true;\n");
    const upperCode = yield* writeArtifact(root, "src/B.ts", "export const upper = true;\n");
    const lowerCode = yield* writeArtifact(root, "src/a.ts", "export const lower = true;\n");
    const delta = yield* writeArtifact(root, "captures/correctness.diff", "");
    const securityDelta = yield* writeArtifact(root, "captures/security.diff", "");
    const configuration = yield* writeArtifact(root, "profiles/correctness.json", '{"id":"reviewer-a"}\n');
    const securityConfiguration = yield* writeArtifact(root, "profiles/security.json", '{"id":"reviewer-b"}\n');
    const specification = overrides.withSpec
      ? yield* writeArtifact(root, "spec/requirements.md", "The ownership fields must match the resolved object.\n")
      : undefined;
    const specDelta = overrides.withSpec ? yield* writeArtifact(root, "captures/spec.diff", "") : undefined;
    const specConfiguration = overrides.withSpec
      ? yield* writeArtifact(root, "profiles/spec.json", '{"id":"reviewer-spec"}\n')
      : undefined;
    const findingEvidence = yield* writeArtifact(
      root,
      "reports/correctness-finding.md",
      "Prior evidence for this axis only.\n",
    );
    const securityFindingEvidence = yield* writeArtifact(root, "reports/security-finding.md", otherAxisMarker);
    const impactEvidence = yield* writeArtifact(root, "reports/impact.md", "The recorded source scope is unchanged.\n");
    const capture = yield* writeJson(root, "captures/source-capture.json", {
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
    const sourceFiles = [code, upperCode, lowerCode];
    const sourcePaths = overrides.missingSourceFile ? [] : sourceFiles;
    const scopePaths = ["src/owned.ts", "src/B.ts", "src/a.ts"].sort();
    const sourceFileRecords = sourceFiles
      .map((file) => ({ path: file.label, sha256: file.sha256 }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const expectedScopeHash = hash(JSON.stringify(sourceFileRecords));
    const expectedComparisonSourceHash = hash(JSON.stringify({ deleted_paths: [], source_files: sourceFileRecords }));
    const rules = [rule, mixedCaseRule];
    const rulesHash = hash(
      JSON.stringify(
        rules
          .map((item) => ({ label: item.label, sha256: item.sha256 }))
          .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)),
      ),
    );
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
    const priorRecord = yield* writeJson(root, "reports/prior-coverage.json", {
      schema: "review-coverage/v1",
      coverage_id: "coverage-owned-api",
      head: PRIOR_HEAD,
      paths: scopePaths,
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
            paths: scopePaths,
            deleted_paths: [],
            changed_paths: overrides.changePath ? [overrides.changePath] : [],
            required_coverage: ["owned API behavior"],
            included_coverage: overrides.includedCoverage ?? ["owned API behavior"],
          },
          source_files: sourcePaths,
          rules,
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
              paths: scopePaths,
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
    const planRef = yield* writeJson(root, "review-plan.json", plan);
    return {
      inputPath: path.join(root, planRef.path),
      otherAxisMarker,
      expectedComparisonSourceHash,
      expectedRulesHash: rulesHash,
    };
  });
}

reviewTest("bundle generation is deterministic and keeps reviewer axes isolated", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const { inputPath, otherAxisMarker, expectedComparisonSourceHash, expectedRulesHash } = yield* reviewPlan(root);
    const first = path.join(root, "output-a");
    const second = path.join(root, "output-b");
    const firstResult = yield* prepareReviewBundle({
      inputPath,
      outputDirectory: first,
      axis: "correctness_reliability",
    });
    const secondResult = yield* prepareReviewBundle({
      inputPath,
      outputDirectory: second,
      axis: "correctness_reliability",
    });
    const firstManifest = yield* readText(firstResult.manifestPath);
    const secondManifest = yield* readText(secondResult.manifestPath);
    const firstPrompt = yield* readText(firstResult.reviewerInputPath);
    const secondPrompt = yield* readText(secondResult.reviewerInputPath);

    expect(firstManifest).toBe(secondManifest);
    expect(firstPrompt).toBe(secondPrompt);
    expect(firstManifest).toMatch(/"semantic_review_status": "not_evaluated"/u);
    expect(firstManifest).toMatch(/"decision": "eligible_candidate"/u);
    const manifest = JSON.parse(firstManifest) as {
      comparison_identity: { source_scope_sha256: string; rules_sha256: string };
    };
    expect(manifest.comparison_identity.source_scope_sha256).toBe(expectedComparisonSourceHash);
    expect(manifest.comparison_identity.rules_sha256).toBe(expectedRulesHash);
    expect(firstPrompt).toMatch(/AR-fixture-001/u);
    expect(firstManifest).not.toContain(otherAxisMarker);
    expect(firstPrompt).not.toContain(otherAxisMarker);
    expect(firstPrompt).not.toMatch(/security_privacy/u);
    expect(firstResult.reviewerInputBytes).toBeLessThan(32 * 1024);
  }),
);

reviewTest("bundle rejects stale capture identity, incomplete coverage, and missing source artifacts", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const staleRoot = path.join(root, "stale");
    yield* makeDirectory(staleRoot);
    const stale = yield* reviewPlan(staleRoot, { captureHead: PRIOR_HEAD });
    const staleError = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: stale.inputPath,
        outputDirectory: path.join(staleRoot, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(staleError.message).toMatch(/Stale source capture identity/u);

    const coverageRoot = path.join(root, "coverage");
    yield* makeDirectory(coverageRoot);
    const coverage = yield* reviewPlan(coverageRoot, { includedCoverage: [] });
    const coverageError = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: coverage.inputPath,
        outputDirectory: path.join(coverageRoot, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(coverageError.message).toMatch(/Incomplete or unexpected coverage/u);

    const missingRoot = path.join(root, "missing");
    yield* makeDirectory(missingRoot);
    const missing = yield* reviewPlan(missingRoot, { missingSourceFile: true });
    const missingSourceError = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: missing.inputPath,
        outputDirectory: path.join(missingRoot, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(missingSourceError.message).toMatch(/source_files must contain/u);

    const missingFileRoot = path.join(root, "missing-file");
    yield* makeDirectory(missingFileRoot);
    const missingFile = yield* reviewPlan(missingFileRoot);
    const missingPlan = JSON.parse(yield* readText(missingFile.inputPath)) as {
      reviewers: { correctness_reliability: { source_files: Array<{ label: string; path: string; sha256: string }> } };
    };
    missingPlan.reviewers.correctness_reliability.source_files[0].path = "src/does-not-exist.ts";
    yield* writeText(missingFile.inputPath, `${JSON.stringify(missingPlan, null, 2)}\n`);
    const missingFileError = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: missingFile.inputPath,
        outputDirectory: path.join(missingFileRoot, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(missingFileError.message).toMatch(/missing or unreadable/u);

    const staleArtifactRoot = path.join(root, "stale-artifact");
    yield* makeDirectory(staleArtifactRoot);
    const staleArtifact = yield* reviewPlan(staleArtifactRoot);
    yield* writeText(path.join(staleArtifactRoot, "src/owned.ts"), "export const owned = false;\n");
    const staleArtifactError = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: staleArtifact.inputPath,
        outputDirectory: path.join(staleArtifactRoot, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(staleArtifactError.message).toMatch(/SHA-256 mismatch/u);
  }),
);

reviewTest("carry candidates require unchanged inputs and scope evidence", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const sourcePath = yield* reviewPlan(root, { changePath: "src/owned.ts" });
    const output = path.join(root, "output");
    yield* prepareReviewBundle({
      inputPath: sourcePath.inputPath,
      outputDirectory: output,
      axis: "correctness_reliability",
    });
    const manifest = JSON.parse(yield* readText(path.join(output, "review-manifest.json"))) as {
      coordinator_only: {
        carry_candidates: Array<{ decision: string; reasons: Array<string>; semantic_approval: boolean }>;
      };
    };
    const [candidate] = manifest.coordinator_only.carry_candidates;
    expect(candidate.decision).toBe("review_required");
    expect(candidate.reasons).toContain("changed_path_intersects_scope");
    expect(candidate.semantic_approval).toBe(false);

    const changedInputRoot = path.join(root, "changed-input");
    yield* makeDirectory(changedInputRoot);
    const changedInput = yield* reviewPlan(changedInputRoot, { previousDependenciesSha: hash("prior-dependency-set") });
    const changedOutput = path.join(changedInputRoot, "output");
    yield* prepareReviewBundle({
      inputPath: changedInput.inputPath,
      outputDirectory: changedOutput,
      axis: "correctness_reliability",
    });
    const changedManifest = JSON.parse(yield* readText(path.join(changedOutput, "review-manifest.json"))) as {
      coordinator_only: { carry_candidates: Array<{ decision: string; reasons: Array<string> }> };
    };
    const [changedCandidate] = changedManifest.coordinator_only.carry_candidates;
    expect(changedCandidate.decision).toBe("review_required");
    expect(changedCandidate.reasons).toContain("dependencies_changed");
  }),
);

reviewTest("bundle refuses inline prior report text", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const fixture = yield* reviewPlan(root);
    const plan = JSON.parse(yield* readText(fixture.inputPath)) as {
      reviewers: { correctness_reliability: { prior_findings: Array<{ summary: string }> } };
    };
    plan.reviewers.correctness_reliability.prior_findings[0].summary = `token: \"ghp_${"A".repeat(36)}\"`;
    yield* writeText(fixture.inputPath, `${JSON.stringify(plan, null, 2)}\n`);
    const error = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: fixture.inputPath,
        outputDirectory: path.join(root, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(error.message).toMatch(/axis-specific evidence reference instead of inline report text/u);
  }),
);

reviewTest("bundle refuses credential-shaped inline metadata", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const fixture = yield* reviewPlan(root);
    const plan = JSON.parse(yield* readText(fixture.inputPath)) as {
      reviewers: { correctness_reliability: { prior_findings: Array<{ evidence: { label: string } }> } };
    };
    plan.reviewers.correctness_reliability.prior_findings[0].evidence.label = `ghp_${"A".repeat(36)}`;
    yield* writeText(fixture.inputPath, `${JSON.stringify(plan, null, 2)}\n`);
    const error = yield* Effect.flip(
      prepareReviewBundle({
        inputPath: fixture.inputPath,
        outputDirectory: path.join(root, "out"),
        axis: "correctness_reliability",
      }),
    );
    expect(error.message).toMatch(/common credential pattern/u);
  }),
);

reviewTest("risk reviewers compare spec identity without receiving spec files", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const fixture = yield* reviewPlan(root, { withSpec: true });
    const riskOutput = path.join(root, "risk-output");
    yield* prepareReviewBundle({
      inputPath: fixture.inputPath,
      outputDirectory: riskOutput,
      axis: "correctness_reliability",
    });
    const riskPrompt = yield* readText(path.join(riskOutput, "reviewer-input.md"));
    const riskManifest = JSON.parse(yield* readText(path.join(riskOutput, "review-manifest.json"))) as {
      coordinator_only: { carry_candidates: Array<{ reasons: Array<string> }> };
    };
    expect(riskPrompt).not.toMatch(/spec\/requirements\.md/u);
    expect(riskManifest.coordinator_only.carry_candidates[0].reasons).toContain("specification_changed");

    const specOutput = path.join(root, "spec-output");
    yield* prepareReviewBundle({ inputPath: fixture.inputPath, outputDirectory: specOutput, axis: "spec_conformance" });
    const specPrompt = yield* readText(path.join(specOutput, "reviewer-input.md"));
    expect(specPrompt).toMatch(/spec\/requirements\.md/u);
    expect(specPrompt).not.toMatch(/rules\/backend\.md/u);
  }),
);

/** Builds matching or deliberately stale records for conditional-grant tests. */
function grantFixture(root: string, options: { sourceHead?: string; grantTarget?: string } = {}) {
  return Effect.gen(function* () {
    const base = BASE;
    const head = HEAD;
    const capture = yield* writeJson(root, "capture.json", {
      schema: "review-source-capture/v1",
      run_id: "run-fixture",
      base,
      head: options.sourceHead ?? head,
      capture_id: "capture-fixture",
      deltas: {},
    });
    const prerequisite = yield* writeJson(root, "prerequisite.json", {
      schema: "review-prerequisite-receipt/v1",
      id: "required-checks",
      status: "passed",
      head,
      capture_id: "capture-fixture",
    });
    const state = yield* writeJson(root, "reservation.json", {
      schema: "review-quota-reservation/v1",
      reservation_id: "reserve-1",
      pool: "local-reviewer",
      phase: "coordinated-review",
      head,
      coordinator_thread_id: "coordinator-1",
      status: "reserved",
      remaining_invocations: 1,
    });
    const nativeReceipt = yield* writeJson(root, "native-grant.json", { accepted: true, message_id: "grant-message" });
    const grant = yield* writeJson(root, "grant.json", {
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
    const input = yield* writeJson(root, "conditional-input.json", {
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
  });
}

reviewTest("conditional grants require matching source, prerequisites, reservation, and native receipt", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const fixture = yield* grantFixture(root);
    const before = yield* readBytes(fixture.statePath);
    const result = yield* checkConditionalGrant({
      inputPath: fixture.inputPath,
      outputPath: path.join(root, "grant-check.json"),
    });
    const after = yield* readBytes(fixture.statePath);
    expect(result.status).toBe("predicates_satisfied");
    expect(after).toEqual(before);
    const output = JSON.parse(yield* readText(result.outputPath)) as {
      grants_capacity: boolean;
      performs_native_start: boolean;
    };
    expect(output.grants_capacity).toBe(false);
    expect(output.performs_native_start).toBe(false);

    const staleRoot = path.join(root, "stale-grant");
    yield* makeDirectory(staleRoot);
    const stale = yield* grantFixture(staleRoot, { sourceHead: PRIOR_HEAD });
    const staleResult = yield* checkConditionalGrant({
      inputPath: stale.inputPath,
      outputPath: path.join(staleRoot, "grant-check.json"),
    });
    expect(staleResult.status).toBe("reconcile");
    expect(staleResult.checks.some((check) => check.id === "frozen_source" && check.passed === false)).toBe(true);

    const wrongTargetRoot = path.join(root, "wrong-target");
    yield* makeDirectory(wrongTargetRoot);
    const wrongTarget = yield* grantFixture(wrongTargetRoot, { grantTarget: "worker-elsewhere" });
    const wrongTargetResult = yield* checkConditionalGrant({
      inputPath: wrongTarget.inputPath,
      outputPath: path.join(wrongTargetRoot, "grant-check.json"),
    });
    expect(wrongTargetResult.status).toBe("reconcile");
    expect(
      wrongTargetResult.checks.some((check) => check.id === "native_grant_receipt" && check.passed === false),
    ).toBe(true);
  }),
);

reviewTest("native start receipts count each actual start ID once", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
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
    const nativeReceipt = yield* writeArtifact(
      root,
      "native/native-start.json",
      '{"accepted":true,"request_id":"native-run-1"}\n',
    );
    const startWithReceipt = { ...start, native_receipt: nativeReceipt };
    const first = yield* writeJson(root, "start-one.json", startWithReceipt);
    const second = yield* writeJson(root, "start-two.json", startWithReceipt);
    const input = yield* writeJson(root, "starts.json", {
      schema: "review-native-starts/v1",
      run_id: "run-fixture",
      phase: "coordinated-review",
      base: BASE,
      head: HEAD,
      starts: [
        {
          expected: {
            axis: "correctness_reliability",
            reviewer_id: "reviewer-a",
            model: "model-a",
            pool_id: "local-reviewer",
          },
          receipt: first,
        },
        {
          expected: {
            axis: "correctness_reliability",
            reviewer_id: "reviewer-a",
            model: "model-a",
            pool_id: "local-reviewer",
          },
          receipt: second,
        },
      ],
    });
    const result = yield* countNativeStarts({
      inputPath: path.join(root, input.path),
      outputPath: path.join(root, "starts-accounted.json"),
    });
    expect(result.uniqueStarts).toBe(1);
    expect(result.duplicateReceipts).toBe(1);
    const output = JSON.parse(yield* readText(result.outputPath)) as {
      mutates_quota_state: boolean;
      unique_start_count: number;
    };
    expect(output.mutates_quota_state).toBe(false);
    expect(output.unique_start_count).toBe(1);

    const fallbackStart = {
      ...startWithReceipt,
      native_id_available: false,
      native_start_id: undefined,
      invocation_id: "run-fixture-reviewer-a-1",
    };
    const fallbackOne = yield* writeJson(root, "fallback-start-one.json", fallbackStart);
    const fallbackTwo = yield* writeJson(root, "fallback-start-two.json", fallbackStart);
    const fallbackInput = yield* writeJson(root, "fallback-starts.json", {
      schema: "review-native-starts/v1",
      run_id: "run-fixture",
      phase: "coordinated-review",
      base: BASE,
      head: HEAD,
      starts: [
        {
          expected: {
            axis: "correctness_reliability",
            reviewer_id: "reviewer-a",
            model: "model-a",
            pool_id: "local-reviewer",
          },
          receipt: fallbackOne,
        },
        {
          expected: {
            axis: "correctness_reliability",
            reviewer_id: "reviewer-a",
            model: "model-a",
            pool_id: "local-reviewer",
          },
          receipt: fallbackTwo,
        },
      ],
    });
    const fallbackResult = yield* countNativeStarts({
      inputPath: path.join(root, fallbackInput.path),
      outputPath: path.join(root, "fallback-accounted.json"),
    });
    expect(fallbackResult.uniqueStarts).toBe(1);
    expect(fallbackResult.duplicateReceipts).toBe(1);
    const fallbackOutput = JSON.parse(yield* readText(fallbackResult.outputPath)) as {
      unique_starts: Array<{ native_id_available: boolean; invocation_id: string }>;
    };
    expect(fallbackOutput.unique_starts[0].native_id_available).toBe(false);
    expect(fallbackOutput.unique_starts[0].invocation_id).toBe("run-fixture-reviewer-a-1");

    const expectedFallback = {
      axis: "correctness_reliability",
      reviewer_id: "reviewer-a",
      model: "model-a",
      pool_id: "local-reviewer",
    };
    const fallbackFailures = [
      {
        receipt: { ...fallbackStart, run_id: "different-run" },
        expected: expectedFallback,
        message: "belongs to a different run, phase, or source",
      },
      {
        receipt: fallbackStart,
        expected: { ...expectedFallback, reviewer_id: "reviewer-b" },
        message: "does not match its expected axis, reviewer, model, or quota pool",
      },
      {
        receipt: { ...fallbackStart, status: "rejected" },
        expected: expectedFallback,
        message: "does not record an accepted start",
      },
    ];
    for (const [index, failure] of fallbackFailures.entries()) {
      const failureReceipt = yield* writeJson(root, `fallback-failure-${index}.json`, failure.receipt);
      const failureInput = yield* writeJson(root, `fallback-failure-${index}-input.json`, {
        schema: "review-native-starts/v1",
        run_id: "run-fixture",
        phase: "coordinated-review",
        base: BASE,
        head: HEAD,
        starts: [{ expected: failure.expected, receipt: failureReceipt }],
      });
      const error = yield* Effect.flip(
        countNativeStarts({
          inputPath: path.join(root, failureInput.path),
          outputPath: path.join(root, `fallback-failure-${index}-output.json`),
        }),
      );
      expect(error.message).toContain("starts[0] (run:run-fixture:run-fixture-reviewer-a-1)");
      expect(error.message).toContain(failure.message);
    }
  }),
);

reviewTest("native start accounting accepts bounded receipts whose output exceeds the bundle manifest cap", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const nativeReceipt = yield* writeArtifact(root, "native/native-start.json", '{"accepted":true}\n');
    const reviewerId = `reviewer-${"r".repeat(240)}`;
    const model = `model-${"m".repeat(240)}`;
    const pool = `pool-${"p".repeat(240)}`;
    const starts = [];

    for (let index = 0; index < 80; index += 1) {
      const receipt = yield* writeJson(root, `starts/start-${index}.json`, {
        schema: "review-native-start/v1",
        native_start_id: `native-run-${index}`,
        run_id: "run-fixture",
        phase: "coordinated-review",
        base: BASE,
        head: HEAD,
        axis: "correctness_reliability",
        reviewer_id: reviewerId,
        model,
        pool_id: pool,
        status: "started",
        native_id_available: true,
        native_receipt: nativeReceipt,
      });
      starts.push({
        expected: { axis: "correctness_reliability", reviewer_id: reviewerId, model, pool_id: pool },
        receipt,
      });
    }

    const input = yield* writeJson(root, "starts.json", {
      schema: "review-native-starts/v1",
      run_id: "run-fixture",
      phase: "coordinated-review",
      base: BASE,
      head: HEAD,
      starts,
    });
    const output = yield* countNativeStarts({
      inputPath: path.join(root, input.path),
      outputPath: path.join(root, "accounting.json"),
    });
    const outputBytes = yield* readBytes(output.outputPath);
    expect(output.uniqueStarts).toBe(80);
    expect(outputBytes.byteLength).toBeGreaterThan(64 * 1024);
    expect(outputBytes.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);

    const overLimitInput = yield* writeJson(root, "too-many-starts.json", {
      schema: "review-native-starts/v1",
      run_id: "run-fixture",
      phase: "coordinated-review",
      base: BASE,
      head: HEAD,
      starts: [...starts, starts[0]],
    });
    const overLimitError = yield* Effect.flip(
      countNativeStarts({
        inputPath: path.join(root, overLimitInput.path),
        outputPath: path.join(root, "too-many-starts-accounting.json"),
      }),
    );
    expect(overLimitError.message).toContain("starts exceeds the 80 start limit");
  }),
);

reviewTest("native start accounting rejects receipt artifacts beyond its documented byte budget", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const nativeReceipt = yield* writeArtifact(root, "native/native-start.json", '{"accepted":true}\n');
    const receipt = yield* writeJson(root, "start.json", {
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
      native_receipt: { ...nativeReceipt, sections: ["x".repeat(1_100_000)] },
    });
    const input = yield* writeJson(root, "starts.json", {
      schema: "review-native-starts/v1",
      run_id: "run-fixture",
      phase: "coordinated-review",
      base: BASE,
      head: HEAD,
      starts: [
        {
          expected: {
            axis: "correctness_reliability",
            reviewer_id: "reviewer-a",
            model: "model-a",
            pool_id: "local-reviewer",
          },
          receipt,
        },
      ],
    });

    const error = yield* Effect.flip(
      countNativeStarts({ inputPath: path.join(root, input.path), outputPath: path.join(root, "accounting.json") }),
    );
    expect(error.message).toMatch(/1048576 byte total artifact limit/u);
  }),
);

reviewTest("timing merges overlap, excludes concurrency from wall time, and marks unknown intervals", () =>
  Effect.gen(function* () {
    expect((yield* summarizeTiming({ schema: "review-timing/v1", events: [] })).status).toBe("no_recorded_intervals");
    const summary = yield* summarizeTiming({
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
    expect(stages.review).toBe(1200);
    expect(summary.known_interval_union_seconds).toBe(3000);
    expect(summary.concurrent_time_excluded_seconds).toBe(900);
    expect(summary.elapsed_span_seconds).toBe(3000);
    expect(summary.status).toBe("partial_unknown_timestamps");
    expect(summary.no_estimates_used).toBe(true);

    const root = yield* fixtureDirectory();
    const input = yield* writeJson(root, "timing.json", {
      schema: "review-timing/v1",
      events: [{ id: "unknown", stage: "repair", start_at: null, end_at: null }],
    });
    const output = yield* buildTimingSummary({
      inputPath: path.join(root, input.path),
      outputPath: path.join(root, "timing-summary.json"),
    });
    expect(output.summary.status).toBe("partial_unknown_timestamps");
  }),
);

reviewTest("timing output accommodates all accepted unknown interval records", () =>
  Effect.gen(function* () {
    const root = yield* fixtureDirectory();
    const input = yield* writeJson(root, "many-unknown-timings.json", {
      schema: "review-timing/v1",
      events: Array.from({ length: 5000 }, (_, index) => ({
        id: `event-${String(index).padStart(4, "0")}-${"x".repeat(32)}`,
        stage: "review",
        start_at: null,
        end_at: null,
      })),
    });
    const inputBytes = yield* readBytes(path.join(root, input.path));
    expect(inputBytes.byteLength).toBeLessThan(1024 * 1024);
    const output = yield* buildTimingSummary({
      inputPath: path.join(root, input.path),
      outputPath: path.join(root, "many-unknown-timings-summary.json"),
    });
    const outputBytes = yield* readBytes(output.outputPath);
    expect(outputBytes.byteLength).toBeGreaterThan(64 * 1024);
    expect(outputBytes.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(output.summary.unknown_intervals as Array<unknown>).toHaveLength(5000);
  }),
);
