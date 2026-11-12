import type { TrainingInput, Progress, Artifact, ParsedCSV } from "./types";
import type { WorkerMessage } from "./worker-protocol";
import { validateProgress } from "./worker-protocol";
import { validateTabularModel } from "./model-format";
import { validateTable } from "./schema";
import { LIMITS } from "./limits";
import { assert, cancelled } from "./errors";
import { validHash } from "../lib/checksums";
import { runActivity } from "../pwa/update-manager";
export type Job<T> = { result: Promise<T>; cancel: () => void };
function workerJob<T>(
  create: () => Worker,
  prepare: () => Promise<{ value: unknown; transfer?: Transferable[] }>,
  decode: (value: unknown) => T,
  onProgress?: (p: Progress) => void,
): Job<T> {
  let worker: Worker | null = null,
    rejectJob: ((error: unknown) => void) | undefined,
    wasCancelled = false;
  const result = runActivity(async () => {
    if (wasCancelled) throw cancelled();
    const input = await prepare();
    if (wasCancelled) throw cancelled();
    return new Promise<T>((resolve, reject) => {
      rejectJob = reject;
      try {
        worker = create();
        worker.onerror = () =>
          reject(
            new Error(
              "Browser worker failed to load or execute. Check offline shell installation, memory and JavaScript response headers.",
            ),
          );
        worker.onmessageerror = () =>
          reject(new Error("Worker message could not be decoded."));
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          try {
            const data = event.data;
            assert(
              data && typeof data.type === "string",
              "Invalid worker response.",
            );
            if (data.type === "progress")
              onProgress?.(validateProgress(data.progress));
            else if (data.type === "error")
              reject(
                new Error(
                  typeof data.message === "string"
                    ? data.message.slice(0, 1000)
                    : "Worker failed.",
                ),
              );
            else if (data.type === "result") resolve(decode(data.value));
            else reject(new Error("Unknown worker response."));
          } catch (error) {
            reject(error);
          }
        };
        worker.postMessage(input.value, input.transfer ?? []);
      } catch (error) {
        reject(error);
      }
    });
  }).finally(() => {
    (worker as Worker | null)?.terminate();
  });
  return {
    result,
    cancel() {
      wasCancelled = true;
      (worker as Worker | null)?.terminate();
      rejectJob?.(cancelled());
    },
  };
}
export function startTraining(
  input: TrainingInput,
  onProgress?: (p: Progress) => void,
): Job<Artifact> {
  return workerJob(
    () =>
      new Worker(new URL("../workers/tabular.worker.ts", import.meta.url), {
        type: "module",
      }),
    async () => ({ value: input }),
    validateTabularModel,
    onProgress,
  );
}
export function parseCSVFile(
  file: File,
): Job<{ table: ParsedCSV; hash: string }> {
  return workerJob(
    () =>
      new Worker(new URL("../workers/csv.worker.ts", import.meta.url), {
        type: "module",
      }),
    async () => {
      assert(file.size <= LIMITS.fileBytes, "CSV exceeds 16 MB.");
      assert(
        /\.csv$/i.test(file.name),
        "Choose a .csv file (not Excel, TSV or ZIP).",
      );
      const bytes = await file.arrayBuffer();
      return { value: bytes, transfer: [bytes] };
    },
    (raw) => {
      const value = raw as { table: ParsedCSV; hash: string };
      assert(value && validHash(value.hash), "Invalid parsed dataset hash.");
      return { table: validateTable(value.table), hash: value.hash };
    },
  );
}
