let registration: ServiceWorkerRegistration | undefined;
const subscribers = new Set<() => void>();
function changed() {
  subscribers.forEach((fn) => fn());
}
export const offlineState = {
  supported: false,
  controlled: false,
  updateAvailable: false,
  error: "",
};
export function subscribeOffline(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
export function getRegistration() {
  return registration;
}
export async function registerOffline() {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = "/favicon.svg";
  document.head.append(icon);
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "/manifest.webmanifest";
  document.head.append(manifest);
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    offlineState.error =
      "Offline installation requires HTTPS or localhost and service-worker support.";
    changed();
    return;
  }
  offlineState.supported = true;
  try {
    registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { type: "module", scope: "/" },
    );
    function inspect() {
      offlineState.controlled = !!navigator.serviceWorker.controller;
      offlineState.updateAvailable = !!registration?.waiting;
      changed();
    }
    inspect();
    navigator.serviceWorker.addEventListener("controllerchange", inspect);
    registration.addEventListener("updatefound", () => {
      registration?.installing?.addEventListener("statechange", inspect);
    });
    await navigator.serviceWorker.ready;
    inspect();
  } catch (e) {
    offlineState.error =
      e instanceof Error ? e.message : "Offline installation failed.";
    changed();
  }
}