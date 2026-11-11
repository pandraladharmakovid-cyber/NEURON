import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { deleteDB } from "idb";
import { randomSecret } from "../features/sharing/crypto";
import { shareLink } from "../features/sharing/share-links";
import {
  saveReceipt,
  listReceipts,
  forgetReceipt,
  validateReceipt,
  type ShareReceipt,
} from "../features/sharing/receipt.repository";
function receipt(): ShareReceipt {
  return {
    format: "neuron-share-receipt",
    version: 1,
    id: "x".repeat(32),
    name: "Plants",
    projectId: "p",
    versionId: "v",
    createdAt: 1,
    expiresAt: 2,
    deleteToken: randomSecret(),
    link: shareLink("https://neuron.example", "x".repeat(32), randomSecret()),
  };
}
afterEach(async () => {
  await deleteDB("neuron-sharing");
});
describe("independent deletion receipts", () => {
  it("does not overwrite an existing capability with a conflicting receipt", async () => {
    const r = receipt();
    await saveReceipt(r);
    await expect(
      saveReceipt({ ...r, deleteToken: randomSecret() }),
    ).rejects.toThrow("conflicting");
    expect(await listReceipts()).toEqual([r]);
  });
  it("persists and forgets local capabilities", async () => {
    const r = receipt();
    await saveReceipt(r);
    expect(await listReceipts()).toEqual([r]);
    await forgetReceipt(r.id);
    expect(await listReceipts()).toEqual([]);
  });
  it("rejects mismatched link references", () => {
    const r = receipt();
    r.id = "y".repeat(32);
    expect(() => validateReceipt(r)).toThrow("match");
  });
  it("rejects invalid deletion secrets", () => {
    const r = receipt();
    r.deleteToken = "short";
    expect(() => validateReceipt(r)).toThrow();
  });
  it("rejects incoherent expiry", () => {
    const r = receipt();
    r.expiresAt = 0;
    expect(() => validateReceipt(r)).toThrow();
  });
});