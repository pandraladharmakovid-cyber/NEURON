import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { getProject, listSamples, saveProject, deleteLabel } from "../lib/db";
import { type Project, type Sample, uid, errorMessage } from "../lib/types";
import { cleanName } from "../features/projects/project.service";
import { addImages, removeSample } from "../features/datasets/dataset.service";
import { Button } from "../components/ui/Button";
import { FileDropzone } from "../components/ui/FileDropzone";
function Thumbnail({
  sample,
  onRemove,
  disabled,
}: {
  sample: Sample;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(sample.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sample.blob]);
  return (
    <div className="sample-thumb">
      <img src={url} alt="Training sample" />
      <button aria-label="Remove sample" disabled={disabled} onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
export function ProjectPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  async function refresh() {
    try {
      const [p, s] = await Promise.all([getProject(id), listSamples(id)]);
      if (!p) throw new Error("Project not found.");
      setProject(p);
      setSamples(s);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [id]);
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(labelId: string, files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await addImages(id, labelId, files, samples.length, (n) =>
        setStatus(`Saved ${n} of ${files.length} images`),
      );
      setStatus(`Added ${result.saved} images.`);
      if (result.errors.length) setError(result.errors.slice(0, 5).join("\n"));
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function rename(labelId: string, current: string) {
    if (!project) return;
    const name = prompt("Class name", current);
    if (name === null) return;
    await mutate(async () => {
      const clean = cleanName(name);
      if (
        project.labels.some(
          (l) =>
            l.id !== labelId && l.name.toLowerCase() === clean.toLowerCase(),
        )
      )
        throw new Error("Class name already exists.");
      await saveProject({
        ...project,
        labels: project.labels.map((l) =>
          l.id === labelId ? { ...l, name: clean } : l,
        ),
        updatedAt: Date.now(),
      });
    });
  }
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
          Train model <ArrowRight size={17} />
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
        <ImageIcon size={18} />
        <span>
          Your images are processed locally. Uploads are resized to at most
          768px and stored in this browser. Existing models keep their original
          class names until retrained.
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="muted">
          {status}
        </p>
      )}
      <div className="dataset-grid">
        {project.labels.map((label, index) => {
          const images = samples.filter((s) => s.labelId === label.id);
          return (
            <section className="panel class-panel" key={label.id}>
              <div className="section-heading">
                <div className="class-heading">
                  <span className="class-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="class-name"
                    title="Rename class"
                    disabled={busy}
                    onClick={() => void rename(label.id, label.name)}
                  >
                    {label.name} <small>edit</small>
                  </button>
                </div>
                <div className="inline">
                  <span className="count-pill">{images.length}</span>
                  <Button
                    variant="ghost"
                    disabled={busy || project.labels.length <= 2}
                    aria-label={`Delete ${label.name}`}
                    onClick={() => {
                      if (confirm(`Delete ${label.name} and its samples?`))
                        void mutate(() => deleteLabel(project, label.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <FileDropzone
                disabled={busy}
                onFiles={(files) => void upload(label.id, files)}
              />
              <div className="sample-grid">
                {images.slice(0, 120).map((s) => (
                  <Thumbnail
                    key={s.id}
                    sample={s}
                    disabled={busy}
                    onRemove={() => void mutate(() => removeSample(s.id))}
                  />
                ))}
              </div>
              {images.length > 120 && (
                <small>Showing the first 120 of {images.length} images.</small>
              )}
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
      <Button
        variant="secondary"
        disabled={busy || project.labels.length >= 20}
        onClick={() =>
          void mutate(async () => {
            const name = prompt("New class name");
            if (name === null) return;
            const clean = cleanName(name);
            if (
              project.labels.some(
                (l) => l.name.toLowerCase() === clean.toLowerCase(),
              )
            )
              throw new Error("Class name already exists.");
            await saveProject({
              ...project,
              labels: [...project.labels, { id: uid(), name: clean }],
              updatedAt: Date.now(),
            });
          })
        }
      >
        <Plus size={16} /> Add class
      </Button>
      <p className="phase-note">
        {samples.length} / 1,000 images · Diverse backgrounds and lighting
        improve your model. Avoid duplicate frames: they can inflate validation
        scores.
      </p>
    </>
  );
}