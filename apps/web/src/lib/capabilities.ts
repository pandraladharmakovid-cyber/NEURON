export function capabilities() {
  return {
    storage: typeof indexedDB !== "undefined",
    camera: !!navigator.mediaDevices?.getUserMedia,
    secure: window.isSecureContext,
    webgpu: "gpu" in navigator,
  };
}
export async function storageInfo() {
  const e = await navigator.storage?.estimate();
  return {
    usage: e?.usage ?? 0,
    quota: e?.quota ?? 0,
    persistent: (await navigator.storage?.persisted?.()) ?? false,
  };
}
export function bytes(n: number) {
  return n >= 1073741824
    ? `${(n / 1073741824).toFixed(1)} GB`
    : n >= 1048576
      ? `${(n / 1048576).toFixed(1)} MB`
      : `${Math.round(n / 1024)} KB`;
}