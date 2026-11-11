import { embed, makeHead, tf, initializeRuntime } from "../../lib/ml";
import { fromBase64, validateArtifact } from "../../lib/model-format";
import type { ModelArtifact, Prediction } from "../../lib/types";
export async function predictor(value: ModelArtifact) {
  const artifact = validateArtifact(value);
  await initializeRuntime();
  const head = makeHead(artifact.labels.length, 1);
  try {
    const decoded = tf.io.decodeWeights(
      fromBase64(artifact.weightData),
      artifact.weightSpecs,
    );
    try {
      head.setWeights(artifact.weightSpecs.map((s) => decoded[s.name]));
    } finally {
      Object.values(decoded).forEach((t) => t.dispose());
    }
  } catch (e) {
    head.dispose();
    throw e;
  }
  let disposed = false;
  return {
    async predict(blob: Blob): Promise<Prediction[]> {
      if (disposed) throw new Error("Predictor has been disposed.");
      const vector = await embed(blob);
      if (disposed) throw new Error("Predictor has been disposed.");
      const result = tf.tidy(
        () => head.predict(tf.tensor2d(vector, [1, 1280])) as tf.Tensor,
      );
      try {
        const scores = await result.data();
        return artifact.labels
          .map((l, i) => ({ label: l.name, score: scores[i] }))
          .sort((a, b) => b.score - a.score);
      } finally {
        result.dispose();
      }
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        head.dispose();
      }
    },
  };
}