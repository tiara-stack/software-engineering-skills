#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Command, Flag } from "effect/cli";
import { buildTimingSummary, checkConditionalGrant, countNativeStarts, prepareReviewBundle } from "./review-prep-core";

const bundleCommand = Command.make(
  "bundle",
  {
    input: Flag.String("input").pipe(Flag.withDescription("Versioned coordinator review plan JSON")),
    axis: Flag.String("axis").pipe(Flag.withDescription("One independent review axis")),
    output: Flag.String("output").pipe(Flag.withDescription("New output directory for this axis bundle")),
  },
  /** Prepares one isolated axis bundle and reports its artifact references. */
  (options) =>
    Effect.gen(function* () {
      const result = yield* prepareReviewBundle({
        inputPath: options.input,
        axis: options.axis,
        outputDirectory: options.output,
      });
      yield* Console.log(`Coordinator manifest: ${result.manifestPath} (${result.manifestBytes} bytes)`);
      yield* Console.log(`Reviewer input: ${result.reviewerInputPath} (${result.reviewerInputBytes} bytes)`);
      yield* Console.log("The manifest contains carry candidates only. Semantic review status remains unevaluated.");
    }),
).pipe(Command.withDescription("Prepare one bounded, isolated reviewer input from explicit local evidence"));

const grantCommand = Command.make(
  "check-grant",
  {
    input: Flag.String("input").pipe(Flag.withDescription("Conditional grant record and predicate receipts")),
    output: Flag.String("output").pipe(Flag.withDescription("New result JSON path")),
  },
  /** Verifies recorded grant predicates and stops when coordination is needed. */
  (options) =>
    Effect.gen(function* () {
      const result = yield* checkConditionalGrant({ inputPath: options.input, outputPath: options.output });
      yield* Console.log(`Grant predicate check: ${result.status} (${result.outputPath})`);
      if (result.status === "reconcile")
        return yield* Effect.fail(
          new Error("Grant predicates changed or are incomplete; reconcile with the coordinator"),
        );
    }),
).pipe(Command.withDescription("Check a recorded conditional grant without reserving or mutating quota"));

const startsCommand = Command.make(
  "count-starts",
  {
    input: Flag.String("input").pipe(Flag.withDescription("Native start receipt index JSON")),
    output: Flag.String("output").pipe(Flag.withDescription("New result JSON path")),
  },
  /** Counts accepted native starts from their recorded receipt identities. */
  (options) =>
    Effect.gen(function* () {
      const result = yield* countNativeStarts({ inputPath: options.input, outputPath: options.output });
      yield* Console.log(
        `Counted ${result.uniqueStarts} unique native starts; collapsed ${result.duplicateReceipts} duplicate receipts (${result.outputPath})`,
      );
    }),
).pipe(Command.withDescription("Deduplicate actual native start receipts without changing quota state"));

const timingCommand = Command.make(
  "timing",
  {
    input: Flag.String("input").pipe(Flag.withDescription("Recorded phase interval JSON")),
    output: Flag.String("output").pipe(Flag.withDescription("New timing summary JSON path")),
  },
  /** Writes an interval summary using only recorded timestamps. */
  (options) =>
    Effect.gen(function* () {
      const result = yield* buildTimingSummary({ inputPath: options.input, outputPath: options.output });
      yield* Console.log(`Timing summary: ${result.outputPath} (${result.summary.status})`);
    }),
).pipe(Command.withDescription("Summarize recorded intervals without adding concurrent time twice"));

export const command = Command.make("review-prep").pipe(
  Command.withDescription("Prepare bounded review evidence and check recorded workflow inputs"),
  Command.withSubcommands([bundleCommand, grantCommand, startsCommand, timingCommand]),
);

export const main = Command.run(command, { version: "review-prep/v1" }).pipe(Effect.provide(NodeServices.layer));

export const runMain = () => NodeRuntime.runMain(main);

/** Resolves executable paths for reliable direct-invocation checks. */
const canonicalPath = (value: string) => {
  try {
    return realpathSync(value);
  } catch {
    return path.normalize(path.resolve(value));
  }
};

/** Distinguishes direct CLI execution from importing the command module. */
const isMain = () =>
  process.argv[1] !== undefined && canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(import.meta.url));

if (isMain()) runMain();
