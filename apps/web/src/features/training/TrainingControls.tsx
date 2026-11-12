import { Play, Square } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { useImageTraining } from "./training.store";
export function TrainingControls({
  state,
}: {
  state: ReturnType<typeof useImageTraining>;
}) {
  const {
    epochs,
    setEpochs,
    rate,
    setRate,
    running,
    samples,
    project,
    ready,
    start,
    cancel,
  } = state;
  return (
    <section className="panel">
      <h2>Training settings</h2>
      <p className="muted">
        MobileNet v2 extracts image features; a local classifier learns your
        classes.
      </p>
      <label className="field">
        Epochs
        <input
          type="number"
          min="1"
          max="100"
          step="1"
          value={epochs}
          disabled={running}
          onChange={(e) => setEpochs(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Learning rate
        <select
          value={rate}
          disabled={running}
          onChange={(e) => setRate(Number(e.target.value))}
        >
          <option value="0.0001">0.0001 — careful</option>
          <option value="0.001">0.001 — recommended</option>
          <option value="0.01">0.01 — aggressive</option>
        </select>
      </label>
      <dl className="summary-list">
        <div>
          <dt>Dataset</dt>
          <dd>{samples.length} images</dd>
        </div>
        <div>
          <dt>Classes</dt>
          <dd>{project?.labels.length ?? 0}</dd>
        </div>
        <div>
          <dt>Validation split</dt>
          <dd>20% per class</dd>
        </div>
        <div>
          <dt>Split seed</dt>
          <dd>42</dd>
        </div>
      </dl>
      {running ? (
        <Button variant="danger" onClick={cancel}>
          <Square size={15} /> Cancel training
        </Button>
      ) : (
        <Button disabled={!ready} onClick={() => void start()}>
          <Play size={16} /> Train model
        </Button>
      )}
      {!ready && (
        <p className="muted">Add at least 5 images to each class to begin.</p>
      )}
      <p className="phase-note">
        First run installs a verified encoder pack if needed. Keep this page
        open; leaving cancels the job. CPU fallback can be slow.
      </p>
    </section>
  );
}
