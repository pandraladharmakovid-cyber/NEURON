import { trackTransaction } from "../../lib/db";
import { database, activateVersion } from "../../lib/db";
import { sha256 } from "../../lib/checksums";
import {
  uid,
  type FeedbackItem,
  type ModelVersion,
  type Sample,
} from "../../lib/types";
import { runActivity } from "../../pwa/update-manager";
export function comparable(a: ModelVersion, b: ModelVersion) {
  return (
    !!a.artifact.provenance?.validationHash &&
    a.artifact.provenance.validationHash ===
      b.artifact.provenance?.validationHash
  );
}
export async function queueFeedback(
  projectId: string,
  versionId: string,
  labelId: string,
  blob: Blob,
  predictedLabel: string,
) {
  if (blob.type !== "image/jpeg" || blob.size > 1024 * 1024)
    throw new Error("Feedback must be a normalized JPEG under 1 MB.");
  const db = await database(),
    tx = trackTransaction(
      db.transaction(["projects", "versions", "feedback"], "readwrite"),
    ),
    p = await tx.objectStore("projects").get(projectId),
    v = await tx.objectStore("versions").get(versionId);
  const existing = await tx
    .objectStore("feedback")
    .index("by-project")
    .getAllKeys(projectId);
  if (
    !p ||
    !v ||
    v.projectId !== projectId ||
    !p.labels.some((l) => l.id === labelId) ||
    existing.length >= 100
  ) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(
      "Class/model changed or feedback queue has reached 100 items.",
    );
  }
  const item: FeedbackItem = {
    id: uid(),
    projectId,
    versionId,
    labelId,
    blob,
    predictedLabel: predictedLabel.slice(0, 64),
    createdAt: Date.now(),
  };
  await tx.objectStore("feedback").add(item);
  await tx.done;
  return item;
}
export async function listFeedback(projectId: string) {
  return (await database()).getAllFromIndex(
    "feedback",
    "by-project",
    projectId,
  );
}
export async function discardFeedback(id: string) {
  await (await database()).delete("feedback", id);
}
export async function approveFeedback(id: string) {
  return runActivity(async () => {
    const db = await database(),
      item = await db.get("feedback", id);
    if (!item) throw new Error("Feedback no longer exists.");
    const hash = await sha256(item.blob);
    // Legacy samples can be hashed before opening the final write transaction.
    for (const old of await db.getAllFromIndex(
      "samples",
      "by-project",
      item.projectId,
    )) {
      if (old.hash) continue;
      const value = await sha256(old.blob);
      const t = trackTransaction(db.transaction("samples", "readwrite"));
      const current = await t.store.get(old.id);
      if (current) await t.store.put({ ...current, hash: value });
      await t.done;
    }
    const tx = trackTransaction(
      db.transaction(["projects", "samples", "feedback"], "readwrite"),
    );
    const live = await tx.objectStore("feedback").get(id),
      p = await tx.objectStore("projects").get(item.projectId),
      samples = await tx
        .objectStore("samples")
        .index("by-project")
        .getAll(item.projectId);
    if (
      !live ||
      !p ||
      !p.labels.some((l) => l.id === item.labelId) ||
      samples.length >= 1000 ||
      samples.some((s) => s.hash === hash)
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "Feedback changed, image already exists, or sample limit reached. Discard duplicates.",
      );
    }
    const sample: Sample = {
      id: uid(),
      projectId: item.projectId,
      labelId: item.labelId,
      blob: item.blob,
      createdAt: Date.now(),
      hash,
    };
    await tx.objectStore("samples").add(sample);
    await tx.objectStore("feedback").delete(id);
    await tx.objectStore("projects").put({ ...p, updatedAt: Date.now() });
    await tx.done;
  });
}
export { activateVersion };