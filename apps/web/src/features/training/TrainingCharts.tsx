import { Progress } from "../../components/ui/Progress";
import { Activity, ArrowRight } from "lucide-react";
import { backendName } from "../../lib/ml";
import type { TrainingProgress } from "./training.service";
import type { ModelArtifact } from "../../lib/types";
export function TrainingCharts({
  progress,
  result,
  id,
  running,
}: {
  running: boolean;
  progress: TrainingProgress | null;
  result: ModelArtifact | null;
  id: string;
}) {
  const last = progress?.metrics.at(-1);
  return (
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
          <Progress
            value={progress.done}
            total={progress.total}
            label={progress.stage}
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
                <span style={{ height: `${Math.max(1, m.accuracy * 100)}%` }} />
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
            Held-out validation: {(result.evaluation.accuracy * 100).toFixed(1)}
            % on {result.evaluation.total} images.
          </p>
          <a className="btn btn-primary" href={`#/projects/${id}/predict`}>
            Try your model <ArrowRight size={16} />
          </a>
        </div>
      )}
    </section>
  );
}
