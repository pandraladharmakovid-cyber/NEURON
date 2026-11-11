import { useEffect, useState } from "react";
import { getProject, listVersions } from "../lib/db";
import { type Project, type ModelVersion, errorMessage } from "../lib/types";
import { FeedbackQueue } from "../features/evolution/FeedbackQueue";
import { VersionHistory } from "../features/evolution/VersionHistory";
import { ComparisonPanel } from "../features/evolution/ComparisonPanel";
export function EvolutionPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null),
    [versions, setVersions] = useState<ModelVersion[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([getProject(id), listVersions(id)])
      .then(([p, v]) => {
        if (alive) {
          setProject(p ?? null);
          setVersions(v);
          if (!p) setError("Project not found.");
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return (
    <>
      <a className="back-link" href={`#/projects/${id}`}>
        ← Dataset
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">04 / EVOLVE WITH YOUR PERMISSION</div>
          <h1>Keep learning. Stay in control.</h1>
          <p>
            Review examples, retrain explicitly, and choose which model to
            activate.
          </p>
        </div>
        <a className="btn btn-secondary" href={`#/projects/${id}/predict`}>
          Make predictions
        </a>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {project && (
        <div className="evolution-stack">
          <FeedbackQueue project={project} />
          <ComparisonPanel versions={versions} />
          <VersionHistory
            versions={versions}
            activeId={project.activeVersionId}
            projectId={id}
            onActivate={(activeVersionId) =>
              setProject({ ...project, activeVersionId })
            }
          />
        </div>
      )}
    </>
  );
}