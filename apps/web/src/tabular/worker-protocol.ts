import type { Progress, TrainingInput } from "./types";
import {
  validateConfiguration,
  validateOptions,
  validateTable,
} from "./schema";
import { assert } from "./errors";
import { validHash } from "../lib/checksums";
export function validateTrainingInput(input: TrainingInput) {
  assert(
    input && input.dataset && validHash(input.dataset.hash),
    "Missing or invalid training dataset.",
  );
  validateTable(input.dataset);
  validateConfiguration(input.config, input.dataset.headers);
  validateOptions(input.options);
  return input;
}
export function validateProgress(p: Progress) {
  assert(
    p &&
      typeof p.stage === "string" &&
      p.stage.length <= 100 &&
      Number.isInteger(p.epoch) &&
      p.epoch >= 1 &&
      p.epoch <= 500 &&
      Number.isInteger(p.total) &&
      p.total >= p.epoch &&
      p.total <= 500 &&
      Array.isArray(p.history) &&
      p.history.length === p.epoch,
    "Invalid worker progress.",
  );
  for (const e of p.history)
    assert(
      e &&
        [e.epoch, e.trainLoss, e.validationLoss, e.validationScore].every(
          Number.isFinite,
        ),
      "Non-finite worker metrics.",
    );
  return p;
}
export type WorkerMessage =
  | { type: "progress"; progress: Progress }
  | { type: "result"; value: unknown }
  | { type: "error"; message: string };
