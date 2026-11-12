import { oneShotWorker } from "../../lib/worker-client";
import { trackTransaction } from "../../lib/db";
import { database } from "../../lib/db";
import { sha256 } from "../../lib/checksums";
import { uid, type Sample } from "../../lib/types";
export const MAX_SAMPLES = 1000;
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Could not decode this image. Use a valid JPEG, PNG or WebP.",
    );
  }
}
export async function normalizeImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(`${file.name}: only JPEG, PNG and WebP are supported.`);
  if (file.size > 15 * 1024 * 1024)
    throw new Error(`${file.name}: maximum upload size is 15 MB.`);
  if (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  ) {
    return oneShotWorker(
      () =>
        new Worker(
          new URL("../../workers/dataset.worker.ts", import.meta.url),
          { type: "module" },
        ),
      file,
      (value) => {
        if (
          !(value instanceof Blob) ||
          value.type !== "image/jpeg" ||
          !value.size ||
          value.size > 15 * 1024 * 1024
        )
          throw new Error("Invalid normalized worker image.");
        return value;
      },
    );
  }
  const bitmap = await decodeImage(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error("Image exceeds the 40-megapixel safety limit.");
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))),
        "image/jpeg",
        0.88,
      ),
    );
  } finally {
    bitmap.close();
  }
}
export async function addImages(
  projectId: string,
  labelId: string,
  files: File[],
  currentCount: number,
  onProgress: (n: number) => void,
) {
  if (currentCount + files.length > MAX_SAMPLES)
    throw new Error(
      `This phase supports at most ${MAX_SAMPLES} samples per project.`,
    );
  const errors: string[] = [];
  let saved = 0;
  for (const file of files) {
    try {
      const blob = await normalizeImage(file);
      const sample: Sample = {
        id: uid(),
        projectId,
        labelId,
        blob,
        createdAt: Date.now(),
      };
      sample.hash = await sha256(blob);
      const db = await database();
      // Lazily hash Phase 1 samples without recreating records deleted by another tab.
      for (const old of await db.getAllFromIndex(
        "samples",
        "by-project",
        projectId,
      )) {
        if (old.hash) continue;
        const hash = await sha256(old.blob);
        const update = trackTransaction(db.transaction("samples", "readwrite"));
        const current = await update.store.get(old.id);
        if (current) await update.store.put({ ...current, hash });
        await update.done;
      }
      const tx = trackTransaction(
        db.transaction(["projects", "samples"], "readwrite"),
      );
      const project = await tx.objectStore("projects").get(projectId);
      const current = await tx
        .objectStore("samples")
        .index("by-project")
        .getAll(projectId);
      if (
        !project ||
        !project.labels.some((l) => l.id === labelId) ||
        current.length >= MAX_SAMPLES ||
        current.some((s) => s.hash === sample.hash)
      ) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error(
          !project
            ? "Project deleted."
            : current.some((s) => s.hash === sample.hash)
              ? "Duplicate image already exists in this project."
              : "Class changed or project sample limit reached.",
        );
      }
      await tx.objectStore("samples").add(sample);
      await tx
        .objectStore("projects")
        .put({ ...project, updatedAt: Date.now() });
      await tx.done;
      saved++;
    } catch (e) {
      errors.push(
        `${file.name}: ${e instanceof Error ? e.message : "Save failed"}`,
      );
      if (e instanceof DOMException && e.name === "QuotaExceededError") break;
    }
    onProgress(saved);
  }
  return { saved, errors };
}
export async function removeSample(id: string) {
  await (await database()).delete("samples", id);
}
