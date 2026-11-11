const MAGIC = new Uint8Array([78, 82, 78, 1]);
const AAD = new TextEncoder().encode("NEURON-MODEL-SHARE:v1");
export const MAX_CIPHER_BYTES = 8 * 1024 * 1024 + 64;
export function base64url(bytes: Uint8Array) {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unbase64url(value: string, bytes: number) {
  if (
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length !== Math.ceil((bytes * 4) / 3)
  )
    throw new Error("Invalid secret encoding.");
  let raw: string;
  try {
    raw = atob(
      value.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - (value.length % 4)) % 4),
    );
  } catch {
    throw new Error("Invalid secret encoding.");
  }
  const data = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  if (data.length !== bytes || base64url(data) !== value)
    throw new Error("Noncanonical secret encoding.");
  return data;
}
export function randomSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function secretHash(value: string) {
  unbase64url(value, 32);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function encryptModel(plaintext: Uint8Array) {
  if (plaintext.length > MAX_CIPHER_BYTES - 32)
    throw new Error("Model is too large to share.");
  const secret = randomSecret(),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64url(secret, 32),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
    key,
    plaintext as BufferSource,
  );
  const output = new Uint8Array(16 + encrypted.byteLength);
  output.set(MAGIC);
  output.set(iv, 4);
  output.set(new Uint8Array(encrypted), 16);
  return { secret, bytes: output };
}
export async function decryptModel(envelope: Uint8Array, secret: string) {
  if (
    envelope.length < 33 ||
    envelope.length > MAX_CIPHER_BYTES ||
    !MAGIC.every((b, i) => envelope[i] === b)
  )
    throw new Error("Invalid encrypted model envelope.");
  const key = await crypto.subtle.importKey(
    "raw",
    unbase64url(secret, 32),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: envelope.slice(4, 16),
          additionalData: AAD,
          tagLength: 128,
        },
        key,
        envelope.slice(16),
      ),
    );
  } catch {
    throw new Error(
      "Cannot decrypt this model. The key is incorrect or the encrypted file was altered.",
    );
  }
}