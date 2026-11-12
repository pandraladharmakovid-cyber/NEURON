import { useState } from "react";
import { useDataset } from "./dataset.store";
import { ClassEditor } from "./ClassEditor";
import { SampleGrid } from "./SampleGrid";
import { ImportPanel } from "./ImportPanel";
import { CapturePanel } from "./CapturePanel";
import { Button } from "../../components/ui/Button";
export function DatasetEditor({ id }: { id: string }) {
  const state = useDataset(id),
    [adding, setAdding] = useState(false),
    [newName, setNewName] = useState("");
  const { project, samples, busy, error, status, loading } = state;
  if (loading) return <p role="status">Loading your project…</p>;
  if (!project)
    return (
      <p className="error" role="alert">
        {error || "Project not found."}
      </p>
    );
  const ready = project.labels.every(
    (l) => samples.filter((s) => s.labelId === l.id).length >= 5,
  );
  return (
    <>
      <a className="back-link" href="#/projects">
        ← All projects
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">01 / CHOOSE YOUR DATA</div>
          <h1>{project.name}</h1>
          <p>
            Give each class a name, then add diverse examples. At least 5 images
            per class.
          </p>
        </div>
        <a
          className={`btn btn-primary ${!ready || busy ? "disabled" : ""}`}
          aria-disabled={!ready || busy}
          href={ready && !busy ? `#/projects/${id}/train` : undefined}
        >
          Train model →
        </a>
      </div>
      <a className="small-link" href={`#/projects/${id}/evolve`}>
        Review feedback, compare versions & roll back →
      </a>
      <div className="workflow-tabs">
        <span className="current">1. Dataset</span>
        <a href={`#/projects/${id}/train`}>2. Train & evaluate</a>
        <a href={`#/projects/${id}/predict`}>3. Predict & export</a>
      </div>
      <div className="notice">
        Your images are processed locally. Imports/captures are normalized to at
        most 768px and stored in this browser. Existing models keep their
        original class names until retrained.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
      <div className="dataset-grid">
        {project.labels.map((label, index) => {
          const images = samples.filter((s) => s.labelId === label.id);
          return (
            <section className="panel class-panel" key={label.id}>
              <ClassEditor
                label={label}
                index={index}
                count={images.length}
                canDelete={project.labels.length > 2}
                disabled={busy}
                onRename={(name) => state.rename(label.id, name)}
                onDelete={() => {
                  if (confirm(`Delete ${label.name} and its samples?`))
                    void state.deleteClass(label.id);
                }}
              />
              <ImportPanel
                disabled={busy}
                onFiles={(files) => state.upload(label.id, files)}
              />
              <CapturePanel
                className={label.name}
                disabled={busy}
                onFiles={(files) => state.upload(label.id, files)}
              />
              <SampleGrid
                samples={images}
                disabled={busy}
                onRemove={(sampleId) => void state.remove(sampleId)}
              />
              <p
                className={`sample-status ${images.length >= 5 ? "ready" : ""}`}
              >
                {images.length >= 5
                  ? "✓ Ready to train"
                  : `${5 - images.length} more images needed`}
              </p>
            </section>
          );
        })}
      </div>
      {adding ? (
        <form
          className="dataset-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            void state.add(newName).then((ok) => {
              if (!ok) return;
              setAdding(false);
              setNewName("");
            });
          }}
        >
          <label className="field">
            New class name
            <input
              maxLength={64}
              required
              value={newName}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy || !newName.trim()}>
            Save new class
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          disabled={busy || project.labels.length >= 20}
          onClick={() => setAdding(true)}
        >
          + Add class
        </Button>
      )}
      <p className="phase-note">
        {samples.length} / 1,000 images · Diverse backgrounds and lighting
        improve your model. Duplicate exact normalized files are blocked;
        near-duplicate frames are still your responsibility.
      </p>
    </>
  );
}
