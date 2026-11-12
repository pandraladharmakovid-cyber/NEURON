import type { Progress } from "../types";
import { displayNumber } from "../numeric";
export function TrainingMonitor({
  progress,
  running,
}: {
  progress: Progress | null;
  running: boolean;
}) {
  const history = progress?.history ?? [],
    last = history.at(-1),
    max = Math.max(
      0.0001,
      ...history.flatMap((e) => [e.trainLoss, e.validationLoss]),
    );
  const points = (key: "trainLoss" | "validationLoss") =>
    history
      .map(
        (e, i) =>
          `${history.length > 1 ? (i / (history.length - 1)) * 600 : 0},${150 - Math.min(1, e[key] / max) * 140}`,
      )
      .join(" ");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Live training monitor</h2>
        <span className="tag">
          {running
            ? "CPU WORKER ACTIVE"
            : history.length
              ? "FINISHED / STOPPED"
              : "READY"}
        </span>
      </div>
      {progress ? (
        <>
          <p role="status">
            {progress.stage} · epoch {progress.epoch}/{progress.total}
          </p>
          <progress value={progress.epoch} max={progress.total} />
          <div className="csv-metric-grid">
            <div>
              <small>Train loss</small>
              <strong>{last ? displayNumber(last.trainLoss) : "—"}</strong>
            </div>
            <div>
              <small>Validation loss</small>
              <strong>{last ? displayNumber(last.validationLoss) : "—"}</strong>
            </div>
            <div>
              <small>Epochs observed</small>
              <strong>{history.length}</strong>
            </div>
          </div>
          <svg
            className="csv-history-chart"
            viewBox="0 0 600 160"
            role="img"
            aria-label="Observed training and validation loss by epoch"
          >
            <polyline className="train-line" points={points("trainLoss")} />
            <polyline
              className="validation-line"
              points={points("validationLoss")}
            />
          </svg>
          <p className="csv-note">
            Violet: training loss · Cyan: validation loss. Classification uses
            log loss; regression uses normalized target MSE. Values are actual
            worker metrics, not simulated progress.
          </p>
        </>
      ) : (
        <div className="empty-monitor">
          <h3>Your data. Your CPU.</h3>
          <p>Actual epoch metrics appear here after training begins.</p>
        </div>
      )}
    </section>
  );
}
