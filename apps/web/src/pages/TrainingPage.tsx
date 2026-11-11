import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play, Square, Activity } from "lucide-react";
import { getProject, listSamples, commitVersion } from "../lib/db";
import {
  train,
  type TrainingProgress,
} from "../features/training/training.service";
import { backendName } from "../lib/ml";
import {
  type Project,
  type Sample,
  type ModelArtifact,
  errorMessage,
  uid,
} from "../lib/types";
import { Button } from "../components/ui/Button";
export function TrainingPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [error, setError] = useState(""),
    [epochs, setEpochs] = useState(20),
    [rate, setRate] = useState(0.001),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState<TrainingProgress | null>(null),
    [result, setResult] = useState<ModelArtifact | null>(null);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    Promise.all([getProject(id), listSamples(id)])
      .then(([p, s]) => {
        if (alive.current) {
          if (!p) setError("Project not found.");
          setProject(p ?? null);
          setSamples(s);
        }
      })
      .catch((e) => {
        if (alive.current) setError(errorMessage(e));
      });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function start() {
    if (!project || lock.current) return;
    lock.current = true;
    setRunning(true);
    setError("");
    setResult(null);
    const c = new AbortController();
    controller.current = c;
    try {
      const artifact = await train(
        project,
        samples,
        { epochs, learningRate: rate, seed: 42 },
        c.signal,
        (p) => {
          if (alive.current) setProgress(p);
        },
      );
      if (c.signal.aborted) return;
      await commitVersion({
        id: uid(),
        projectId: id,
        artifact,
        createdAt: Date.now(),
      });
      if (alive.current) setResult(artifact);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof DOMException && e.name === "AbortError"
            ? "Training cancelled. The previous saved model is unchanged."
            : errorMessage(e),
        );
    } finally {
      lock.current = false;
      if (alive.current) setRunning(false);
      controller.current = null;
    }
  }
  const last = progress?.metrics.at(-1);
  const ready =
    project &&
    project.labels.every(
      (l) => samples.filter((s) => s.labelId === l.id).length >= 5,
    );
  return (
    <>
      <a className="back-link" href={`#/projects/${id}`}>
        ← Dataset
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">02 / TRAIN ON YOUR DEVICE</div>
          <h1>Let your model learn.</h1>
          <p>Real image features. Real weight updates. No cloud training.</p>
        </div>
        <span className="tag">{project?.name ?? "IMAGE STUDIO"}</span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <a className="small-link" href={`#/projects/${id}/evolve`}>
        Review feedback & compare saved versions →
      </a>
      <div className="training-layout">
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
            <Button
              variant="danger"
              onClick={() => controller.current?.abort()}
            >
              <Square size={15} /> Cancel training
            </Button>
          ) : (
            <Button disabled={!ready} onClick={() => void start()}>
              <Play size={16} /> Train model
            </Button>
          )}
          {!ready && (
            <p className="muted">
              Add at least 5 images to each class to begin.
            </p>
          )}
          <p className="phase-note">
            First run installs a verified encoder pack if needed. Keep this page
            open; leaving cancels the job. CPU fallback can be slow.
          </p>
        </section>
        <section className="panel training-monitor">
          <div className="section-heading">
            <h2>
              <Activity size={19} /> Training monitor
            </h2>
            <span className="tag">
              {running ? "RUNNING" : result ? "SAVED" : "READY"}
            </span>
          </div>
          {progress ? (
            <>
              <p role="status">
                {progress.stage} · {progress.done}/{progress.total}
              </p>
              <progress
                className="progress"
                value={progress.done}
                max={progress.total}
              />
              <div className="metric-grid">
                <div>
                  <small>Training accuracy</small>
                  <strong>
                    {last ? `${(last.accuracy * 100).toFixed(1)}%` : "—"}
                  </strong>
                </div>
                <div>
                  <small>Validation accuracy</small>
                  <strong>
                    {last ? `${(last.valAccuracy * 100).toFixed(1)}%` : "—"}
                  </strong>
                </div>
                <div>
                  <small>Training loss</small>
                  <strong>{last?.loss.toFixed(4) ?? "—"}</strong>
                </div>
                <div>
                  <small>Runtime</small>
                  <strong>{backendName()}</strong>
                </div>
              </div>
              <div
                className="chart"
                aria-label="Epoch training and validation accuracy chart"
              >
                {progress.metrics.map((m) => (
                  <div
                    className="chart-pair"
                    key={m.epoch}
                    title={`Epoch ${m.epoch}: training ${(m.accuracy * 100).toFixed(1)}%, validation ${(m.valAccuracy * 100).toFixed(1)}%`}
                  >
                    <span
                      style={{ height: `${Math.max(1, m.accuracy * 100)}%` }}
                    />
                    <span
                      style={{ height: `${Math.max(1, m.valAccuracy * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <p className="chart-legend">
                <span>● Training</span>
                <span>● Validation</span>
              </p>
            </>
          ) : (
            <div className="empty-monitor">
              <Activity size={40} />
              <h3>Your training journey starts here</h3>
              <p>
                Live progress and actual epoch metrics will appear when training
                begins.
              </p>
            </div>
          )}
          {result && (
            <div className="success">
              <h3>Model trained and saved</h3>
              <p>
                Held-out validation:{" "}
                {(result.evaluation.accuracy * 100).toFixed(1)}% on{" "}
                {result.evaluation.total} images.
              </p>
              <a className="btn btn-primary" href={`#/projects/${id}/predict`}>
                Try your model <ArrowRight size={16} />
              </a>
            </div>
          )}
        </section>
      </div>
      {result && (
        <section className="panel evaluation">
          <h2>Validation confusion matrix</h2>
          <p className="muted">
            Rows: actual class. Columns: predicted class. This is validation
            performance, not a separate test set.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Actual / predicted</th>
                  {result.labels.map((l) => (
                    <th scope="col" key={l.id}>
                      {l.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.evaluation.matrix.map((row, i) => (
                  <tr key={result.labels[i].id}>
                    <th scope="row">{result.labels[i].name}</th>
                    {row.map((n, j) => (
                      <td className={i === j ? "diagonal" : ""} key={j}>
                        {n}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}