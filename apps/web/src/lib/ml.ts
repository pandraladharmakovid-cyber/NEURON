import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import { encoderArtifacts } from "../pwa/asset-manager";
import { decodeImage } from "../features/datasets/dataset.service";
let encoderPromise: Promise<mobilenet.MobileNet> | undefined;
let initPromise: Promise<void> | undefined;
export async function initializeRuntime() {
  return (initPromise ??= (async () => {
    try {
      if (!(await tf.setBackend("webgl"))) throw new Error("WebGL unavailable");
      await tf.ready();
    } catch {
      await tf.setBackend("cpu");
      await tf.ready();
    }
  })());
}
export async function encoder() {
  await initializeRuntime();
  if (!encoderPromise)
    encoderPromise = mobilenet
      .load({
        version: 2,
        alpha: 1.0,
        inputRange: [0, 1],
        modelUrl: { load: encoderArtifacts },
      })
      .catch((e) => {
        encoderPromise = undefined;
        throw new Error(
          `Encoder unavailable. Check Settings → Offline readiness, then retry. ${e instanceof Error ? e.message : ""}`,
        );
      });
  return encoderPromise;
}
export async function embed(blob: Blob) {
  const net = await encoder();
  const bitmap = await decodeImage(blob);
  try {
    // mobilenet's published input union omits ImageBitmap; use a bounded canvas.
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.drawImage(bitmap, 0, 0, 224, 224);
    const t = net.infer(canvas, true) as tf.Tensor;
    try {
      return Float32Array.from(await t.data());
    } finally {
      t.dispose();
    }
  } finally {
    bitmap.close();
  }
}
export function makeHead(classes: number, seed: number) {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [1280],
      units: classes,
      activation: "softmax",
      kernelInitializer: tf.initializers.glorotUniform({ seed }),
      biasInitializer: "zeros",
    }),
  );
  return model;
}
export function backendName() {
  return tf.getBackend() || "not initialized";
}
export { tf };