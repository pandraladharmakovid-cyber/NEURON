import { useEffect, useState } from "react";
import { FolderPlus, ArrowUpRight, Trash2, Image } from "lucide-react";
import { listProjects, deleteProject } from "../lib/db";
import { createProject } from "../features/projects/project.service";
import { type Project, errorMessage } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
export function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      setItems(await listProjects());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const project = await createProject(name);
      location.hash = `/projects/${project.id}`;
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(p: Project) {
    if (
      !confirm(
        `Permanently delete “${p.name}”, its images and all model versions? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteProject(p.id);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LOCAL WORKSPACE</div>
          <h1>
            My projects<span className="count-pill">{items.length}</span>
          </h1>
          <p>Small ideas. Intelligent possibilities. All on your device.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <FolderPlus size={17} /> New project
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading projects…</p>
      ) : items.length ? (
        <div className="project-grid">
          {items.map((p) => (
            <article className="project-card" key={p.id}>
              <div className="section-heading">
                <span className="feature-icon">
                  <Image size={22} />
                </span>
                <span className="tag">IMAGE CLASSIFIER</span>
              </div>
              <a href={`#/projects/${p.id}`} className="project-title">
                {p.name}
                <ArrowUpRight size={19} />
              </a>
              <p>
                {p.labels.length} classes ·{" "}
                {p.activeVersionId ? "Model ready" : "Ready to teach"}
              </p>
              <div className="project-card-footer">
                <small>{new Date(p.updatedAt).toLocaleDateString()}</small>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${p.name}`}
                  disabled={busy}
                  onClick={() => void remove(p)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FolderPlus size={44} />
          <h2>Your next idea starts here</h2>
          <p>Create your first image classifier. No code or account needed.</p>
          <Button onClick={() => setOpen(true)}>
            Create my first project <ArrowUpRight size={16} />
          </Button>
        </div>
      )}
      {open && (
        <Dialog
          title="Create an image project"
          onClose={() => !busy && setOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="field">
              Project name
              <input
                autoFocus
                value={name}
                maxLength={64}
                placeholder="e.g. My plant classifier"
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <p className="muted">
              Start with two classes, add your images, then train on this
              device.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create project"}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}