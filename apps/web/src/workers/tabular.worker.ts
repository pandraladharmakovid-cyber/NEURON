/// <reference lib="webworker" />
import { trainTabular } from "../tabular/train";
import { validateTrainingInput } from "../tabular/worker-protocol";
import { message } from "../tabular/errors";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
let used = false;
scope.onmessage = (event) => {
  if (used) return;
  used = true;
  void (async () => {
    const input = validateTrainingInput(event.data);
    const artifact = await trainTabular(input, (progress) =>
      scope.postMessage({ type: "progress", progress }),
    );
    scope.postMessage({ type: "result", value: artifact });
  })().catch((error) =>
    scope.postMessage({ type: "error", message: message(error) }),
  );
};
