export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function safeFilename(name: string) {
  return name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || "neuron-project";
}