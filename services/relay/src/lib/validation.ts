import { HttpError, MAX_BYTES, TTL_VALUES } from "../config";
export const validId = (s: string) => /^[A-Za-z0-9_-]{32}$/.test(s);
export function ttlValue(value: string | null) {
  if (!value || !/^\d+$/.test(value) || !TTL_VALUES.includes(Number(value)))
    throw new HttpError(400, "Unsupported link lifetime.");
  return Number(value);
}
export function deletionHash(value: string | null) {
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new HttpError(400, "Invalid deletion capability hash.");
  return value;
}
export function deletionToken(request: Request) {
  const match = request.headers
    .get("Authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) throw new HttpError(401, "Deletion capability required.");
  return match[1];
}
export async function hashToken(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function randomId() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export async function readCiphertext(request: Request) {
  const type = request.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (type !== "application/octet-stream")
    throw new HttpError(415, "Only encrypted binary envelopes are accepted.");
  const declared = request.headers.get("Content-Length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
    throw new HttpError(413, "Encrypted model exceeds the size limit.");
  if (!request.body) throw new HttpError(400, "Missing encrypted envelope.");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Encrypted model exceeds the size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    output.set(c, offset);
    offset += c.length;
  }
  if (
    output.length < 33 ||
    output[0] !== 78 ||
    output[1] !== 82 ||
    output[2] !== 78 ||
    output[3] !== 1
  )
    throw new HttpError(400, "Invalid encrypted-envelope header.");
  return output;
}