import { describe, it, expect } from "vitest";
import {
  encryptModel,
  decryptModel,
  randomSecret,
  secretHash,
  base64url,
  unbase64url,
} from "../features/sharing/crypto";
describe("authenticated model encryption", () => {
  it("roundtrips bytes with a fresh key and IV", async () => {
    const bytes = new TextEncoder().encode("sensitive weights");
    const a = await encryptModel(bytes),
      b = await encryptModel(bytes);
    expect(a.secret).not.toBe(b.secret);
    expect(a.bytes).not.toEqual(b.bytes);
    expect(await decryptModel(a.bytes, a.secret)).toEqual(bytes);
  });
  it("rejects wrong keys", async () => {
    const a = await encryptModel(new Uint8Array([1]));
    await expect(decryptModel(a.bytes, randomSecret())).rejects.toThrow(
      "Cannot decrypt",
    );
  });
  it("rejects authenticated ciphertext tampering", async () => {
    const a = await encryptModel(new Uint8Array([1]));
    a.bytes[a.bytes.length - 1] ^= 1;
    await expect(decryptModel(a.bytes, a.secret)).rejects.toThrow("altered");
  });
  it("rejects version/magic tampering", async () => {
    const a = await encryptModel(new Uint8Array([1]));
    a.bytes[3] = 2;
    await expect(decryptModel(a.bytes, a.secret)).rejects.toThrow("envelope");
  });
  it("validates canonical key encodings", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    expect(unbase64url(base64url(bytes), 32)).toEqual(bytes);
    expect(() => unbase64url("a".repeat(43), 32)).toThrow();
  });
  it("hashes deletion tokens deterministically without returning the token", async () => {
    const token = randomSecret();
    expect(await secretHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(await secretHash(token)).toBe(await secretHash(token));
  });
});