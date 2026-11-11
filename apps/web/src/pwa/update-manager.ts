let jobs = 0;
const listeners = new Set<() => void>();
function notify() {
  for (const fn of listeners) fn();
}
export function activeJobs() {
  return jobs;
}
export function subscribeJobs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function runActivity<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    jobs++;
    notify();
    try {
      return await task();
    } finally {
      jobs--;
      notify();
    }
  };
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("neuron-busy", { mode: "shared" }, run);
  return run();
}
export async function installUpdate(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) throw new Error("No waiting update is available.");
  if (!navigator.locks)
    throw new Error(
      "Safe cross-tab updates require Web Locks. Close ALL NEURON tabs and reopen to apply the waiting update.",
    );
  await navigator.locks.request(
    "neuron-busy",
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock || jobs)
        throw new Error(
          "A job is active in a NEURON tab. Finish or cancel it before updating.",
        );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            changed,
          );
          reject(
            new Error("Update timed out. Close all NEURON tabs and reopen."),
          );
        }, 15000);
        const changed = () => {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            changed,
          );
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", changed);
        registration.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
      });
      location.reload();
    },
  );
}