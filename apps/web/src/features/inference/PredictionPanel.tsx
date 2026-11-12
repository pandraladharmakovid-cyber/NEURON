import type { Prediction } from "../../lib/types";
export function PredictionPanel({
  results,
  latency,
  busy,
  ready,
}: {
  results: Prediction[];
  latency: number;
  busy: boolean;
  ready: boolean;
}) {
  return (
    <>
      <div className="section-heading">
        <h2>Predictions</h2>
        <span className="tag">
          {busy ? "PROCESSING" : ready ? "LOCAL INFERENCE" : "LOADING"}
        </span>
      </div>
      {results.length ? (
        <>
          <div className="prediction-winner">
            {results[0].label}
            <strong>{(results[0].score * 100).toFixed(1)}%</strong>
          </div>
          {results.map((r) => (
            <div className="prediction-row" key={r.label}>
              <div>
                <span>{r.label}</span>
                <strong>{(r.score * 100).toFixed(1)}%</strong>
              </div>
              <progress
                aria-label={`Relative score for ${r.label}`}
                value={r.score}
                max={1}
              />
            </div>
          ))}
          <p className="phase-note">
            {Math.round(latency)} ms including normalization and feature
            extraction. Scores are relative softmax outputs, not calibrated
            probabilities or proof of correctness.
          </p>
        </>
      ) : (
        <div className="empty-monitor">
          <p>
            {ready
              ? "Add an unseen image to see actual predictions."
              : "Loading the saved classifier…"}
          </p>
        </div>
      )}
      <div className="notice">
        No image is uploaded. The verified cached encoder works offline. Camera
        frames are processed only when you choose “Predict this frame”.
      </div>
    </>
  );
}
