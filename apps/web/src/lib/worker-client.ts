import { cancelled } from "./errors";
import { runActivity } from "../pwa/update-manager";
export type WorkerReply =
  | { ok: true; value: unknown }
  | { ok: false; error: string };
export async function oneShotWorker<T>(
  create: () => Worker,
  input: unknown,
  decode: (value: unknown) => T,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    transfer?: Transferable[];
  } = {},
): Promise<T> {
  return runActivity(async () => {
    options.signal?.throwIfAborted();
    let worker: Worker | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      abort: () => void = () => {};
    try {
      return await new Promise<T>((resolve, reject) => {
        abort = () => reject(cancelled());
        options.signal?.addEventListener("abort", abort, { once: true });
        worker = create();
        worker.onerror = () =>
          reject(
            new Error(
              "Image worker failed. Verify that the production shell is installed, JavaScript is allowed and memory is available.",
            ),
          );
        worker.onmessageerror = () =>
          reject(new Error("Worker response could not be decoded."));
        worker.onmessage = (event: MessageEvent<WorkerReply>) => {
          try {
            const value = event.data;
            if (!value || typeof value.ok !== "boolean")
              throw new Error("Invalid worker protocol.");
            if (value.ok) resolve(decode(value.value));
            else
              reject(
                new Error(
                  typeof value.error === "string"
                    ? value.error.slice(0, 1000)
                    : "Worker failed.",
                ),
              );
          } catch (error) {
            reject(error);
          }
        };
        timer = setTimeout(
          () =>
            reject(new Error("Image worker timed out. Try a smaller image.")),
          options.timeoutMs ?? 60000,
        );
        worker.postMessage(input, options.transfer ?? []);
      });
    } finally {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      worker?.terminate();
    }
  });
}
