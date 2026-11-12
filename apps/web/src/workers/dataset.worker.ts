/// <reference lib="webworker" />
import { requireCondition, explainError } from "../lib/errors";
const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
let used = false;
scope.onmessage = (event) => {
  if (used) return;
  used = true;
  void (async () => {
    const file = event.data;
    requireCondition(
      file instanceof Blob &&
        ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
        file.size <= 15 * 1024 * 1024,
      "Unsupported image type or size.",
    );
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      requireCondition(
        bitmap.width > 0 &&
          bitmap.height > 0 &&
          bitmap.width * bitmap.height <= 40000000,
        "Image exceeds the 40-megapixel safety limit.",
      );
      const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height)),
        canvas = new OffscreenCanvas(
          Math.max(1, Math.round(bitmap.width * scale)),
          Math.max(1, Math.round(bitmap.height * scale)),
        ),
        ctx = canvas.getContext("2d");
      requireCondition(ctx, "Worker 2D canvas unavailable.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.88,
      });
      scope.postMessage({ ok: true, value: blob });
    } finally {
      bitmap.close();
    }
  })().catch((e) =>
    scope.postMessage({ ok: false, error: explainError(e).message }),
  );
};
