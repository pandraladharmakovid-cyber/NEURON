import type { Options, Dataset, Configuration } from "../types";
import { Button } from "../../components/ui/Button";
export function TrainingControls({
  options,
  onChange,
  dataset,
  config,
  running,
  onStart,
  onCancel,
}: {
  options: Options;
  onChange: (v: Options) => void;
  dataset: Dataset;
  config: Configuration;
  running: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel">
      <h2>Worker training</h2>
      <p>
        Actual{" "}
        {config.task === "classification"
          ? "softmax classification"
          : "linear regression"}{" "}
        optimized on local CPU. No server or encoder download.
      </p>
      <label className="field">
        Maximum epochs
        <input
          type="number"
          min={1}
          max={500}
          disabled={running}
          value={options.epochs}
          onChange={(e) =>
            onChange({ ...options, epochs: Number(e.target.value) })
          }
        />
      </label>
      <label className="field">
        Learning rate
        <select
          value={options.learningRate}
          disabled={running}
          onChange={(e) =>
            onChange({ ...options, learningRate: Number(e.target.value) })
          }
        >
          <option value={0.01}>0.01 — cautious</option>
          <option value={0.03}>0.03 — recommended</option>
          <option value={0.1}>0.1 — aggressive</option>
        </select>
      </label>
      <label className="field">
        L2 regularization
        <input
          type="number"
          min={0}
          max={1}
          step={0.001}
          value={options.l2}
          disabled={running}
          onChange={(e) => onChange({ ...options, l2: Number(e.target.value) })}
        />
      </label>
      <label className="field">
        Split seed
        <input
          type="number"
          min={0}
          max={2147483647}
          step={1}
          disabled={running}
          value={options.seed}
          onChange={(e) =>
            onChange({ ...options, seed: Number(e.target.value) })
          }
        />
      </label>
      <dl className="summary-list">
        <div>
          <dt>Rows</dt>
          <dd>{dataset.rows.length}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{config.target}</dd>
        </div>
        <div>
          <dt>Features</dt>
          <dd>{config.features.length}</dd>
        </div>
        <div>
          <dt>Group split</dt>
          <dd>~70/15/15</dd>
        </div>
        <div>
          <dt>Early-stop patience</dt>
          <dd>{options.patience} epochs</dd>
        </div>
      </dl>
      {running ? (
        <Button variant="danger" onClick={onCancel}>
          Cancel worker training
        </Button>
      ) : (
        <Button onClick={onStart}>Train CSV model</Button>
      )}
      <p className="phase-note">
        Cancellation terminates the worker and does not save partial weights.
        Keep this page open. Early stopping can finish before the maximum epoch
        count.
      </p>
    </section>
  );
}
