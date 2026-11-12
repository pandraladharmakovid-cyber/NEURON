/// <reference lib="webworker" />
import { parseCSV } from "../tabular/csv";
import { LIMITS } from "../tabular/limits";
import { assert, message } from "../tabular/errors";
import { sha256 } from "../lib/checksums";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
let used = false;
scope.onmessage = (event) => {
  if (used) return;
  used = true;
  void (async () => {
    assert(
      event.data instanceof ArrayBuffer &&
        event.data.byteLength <= LIMITS.fileBytes,
      "CSV exceeds the file limit or is not a binary file.",
    );
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(event.data);
    } catch {
      throw new Error(
        "CSV must be UTF-8 text. Export it as CSV UTF-8 and try again.",
      );
    }
    const table = parseCSV(text),
      hash = await sha256(JSON.stringify(table));
    scope.postMessage({ type: "result", value: { table, hash } });
  })().catch((error) =>
    scope.postMessage({ type: "error", message: message(error) }),
  );
};
