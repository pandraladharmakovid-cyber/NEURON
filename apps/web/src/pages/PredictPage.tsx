import { useState } from "react";
import { useImageInference } from "../features/inference/inference.store";
import { PredictionPanel } from "../features/inference/PredictionPanel";
import { LiveCamera } from "../features/inference/LiveCamera";
import { FeedbackCapture } from "../features/inference/FeedbackCapture";
import { FileDropzone } from "../components/ui/FileDropzone";
import { Button } from "../components/ui/Button";
import { LinkShareDialog } from "../features/sharing/LinkShareDialog";
import { ExportDialog } from "../features/sharing/ExportDialog";
export function PredictPage({ id }: { id: string }) {
  const s = useImageInference(id),
    [shareOpen, setShareOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false);
  const version = s.versions.find((v) => v.id === s.selected);
  return (
    <>
      <a className="back-link" href={`#/projects/${id}`}>
        ← Dataset
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">03 / ACTIVATE YOUR IDEA</div>
          <h1>Meet your model.</h1>
          <p>
            Test a new image or a camera frame. Predictions run on this device.
          </p>
        </div>
        {version && (
          <Button variant="secondary" onClick={() => setExportOpen(true)}>
            Export model
          </Button>
        )}
      </div>
      <a className="small-link" href={`#/projects/${id}/evolve`}>
        Feedback review, comparisons & version history →
      </a>
      {version && (
        <div className="share-entry">
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            Create encrypted share link
          </Button>
          <a href="#/shares">Manage share links →</a>
        </div>
      )}
      {shareOpen && version && s.project && (
        <LinkShareDialog
          project={s.project}
          version={version}
          onClose={() => setShareOpen(false)}
        />
      )}{" "}
      {exportOpen && version && (
        <ExportDialog
          artifact={version.artifact}
          name={s.project?.name ?? "model"}
          onClose={() => setExportOpen(false)}
        />
      )}{" "}
      {s.error && (
        <p role="alert" className="error">
          {s.error}
        </p>
      )}
      {s.loading ? (
        <p role="status">Loading saved models…</p>
      ) : !s.versions.length ? (
        <div className="empty-state">
          <h2>No saved model yet</h2>
          <p>
            Train your dataset first, or import a supported model in Settings.
          </p>
          <a className="btn btn-primary" href={`#/projects/${id}/train`}>
            Go to training
          </a>
        </div>
      ) : (
        <>
          <section className="panel version-bar">
            <label className="field">
              Model version
              <select
                disabled={s.busy}
                value={s.selected}
                onChange={(e) => s.setSelected(e.target.value)}
              >
                {s.versions.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    Version {s.versions.length - i} ·{" "}
                    {new Date(v.createdAt).toLocaleString()} ·{" "}
                    {(v.artifact.evaluation.accuracy * 100).toFixed(1)}%
                    validation
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={
                s.busy || !s.project || s.selected === s.project.activeVersionId
              }
              onClick={() => void s.makeActive()}
            >
              Make active
            </Button>
          </section>
          <div className="prediction-layout">
            <section className="panel">
              <h2>Give it something new</h2>
              <FileDropzone
                multiple={false}
                disabled={!s.ready || s.busy}
                onFiles={(files) => void s.fromFile(files)}
              />
              <LiveCamera
                disabled={!s.ready || s.busy}
                onCapture={(file) => s.fromFile([file])}
              />
              {s.preview && (
                <img
                  className="prediction-image"
                  src={s.preview}
                  alt="Image being classified"
                />
              )}
            </section>
            <section className="panel">
              <PredictionPanel
                results={s.results}
                latency={s.latency}
                busy={s.busy}
                ready={s.ready}
              />
              {s.feedbackBlob && s.project && version && s.results[0] && (
                <FeedbackCapture
                  key={s.preview}
                  project={s.project}
                  versionId={version.id}
                  blob={s.feedbackBlob}
                  predictedLabel={s.results[0].label}
                />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
