export async function sha256(value: Blob | ArrayBuffer | Uint8Array | string) {
  const data =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof Blob
        ? await value.arrayBuffer()
        : value;
  const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}