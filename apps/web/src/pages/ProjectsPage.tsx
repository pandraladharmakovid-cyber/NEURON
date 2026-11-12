import { useState } from "react";
import { FolderPlus, ArrowUpRight, Trash2, Image } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ProjectWizard } from "../features/projects/ProjectWizard";
import { useProjects } from "../features/projects/project.store";
export function ProjectsPage() {
  const { items, loading, busy, error, remove } = useProjects(),
    [open, setOpen] = useState(false);
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
      <div className="modality-tabs">
        <span className="current">Image projects</span>
        <a href="#/tabular">CSV / tabular projects →</a>
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
      {open && <ProjectWizard onClose={() => setOpen(false)} />}
    </>
  );
}
