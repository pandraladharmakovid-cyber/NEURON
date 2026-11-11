import { openDB } from "idb";
import { parseShareLink, validShareId } from "./share-links";
import { unbase64url } from "./crypto";
export type ShareReceipt = {
  format: "neuron-share-receipt";
  version: 1;
  id: string;
  projectId: string;
  versionId: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  deleteToken: string;
  link: string;
};
const db = () =>
  openDB("neuron-sharing", 1, {
    upgrade(database) {
      database.createObjectStore("receipts", { keyPath: "id" });
    },
  });
export function validateReceipt(value: unknown): ShareReceipt {
  const r = value as ShareReceipt;
  if (
    !r ||
    r.format !== "neuron-share-receipt" ||
    r.version !== 1 ||
    !validShareId(r.id ?? "") ||
    typeof r.projectId !== "string" ||
    r.projectId.length > 100 ||
    typeof r.versionId !== "string" ||
    r.versionId.length > 100 ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 64 ||
    !Number.isFinite(r.createdAt) ||
    !Number.isFinite(r.expiresAt) ||
    r.expiresAt <= r.createdAt ||
    typeof r.link !== "string" ||
    r.link.length > 2048
  )
    throw new Error("Invalid share receipt.");
  unbase64url(r.deleteToken, 32);
  if (parseShareLink(r.link).id !== r.id)
    throw new Error("Receipt link does not match its reference.");
  return structuredClone(r);
}
export async function saveReceipt(receipt: ShareReceipt) {
  const database = await db();
  try {
    const safe = validateReceipt(receipt);
    const tx = database.transaction("receipts", "readwrite");
    void tx.done.catch(() => {});
    const existing = await tx.store.get(safe.id);
    if (
      existing &&
      (existing.link !== safe.link || existing.deleteToken !== safe.deleteToken)
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "A conflicting receipt already exists. Existing access/deletion capabilities were not replaced.",
      );
    }
    await tx.store.put(safe);
    await tx.done;
  } finally {
    database.close();
  }
}
export async function listReceipts(): Promise<ShareReceipt[]> {
  const database = await db();
  try {
    return (await database.getAll("receipts"))
      .map(validateReceipt)
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}
export async function forgetReceipt(id: string) {
  const database = await db();
  try {
    await database.delete("receipts", id);
  } finally {
    database.close();
  }
}
export async function importReceipt(file: File, origin: string) {
  if (file.size > 16384) throw new Error("Receipt exceeds the 16 KB limit.");
  const receipt = validateReceipt(JSON.parse(await file.text()));
  if (parseShareLink(receipt.link).origin !== origin)
    throw new Error(
      "This receipt belongs to another application origin. Open that origin to manage it.",
    );
  await saveReceipt(receipt);
  return receipt;
}