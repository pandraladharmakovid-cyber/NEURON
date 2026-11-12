import { useTabularProject } from "../tabular/hooks/useTabularProject";
import { StudioHeader } from "../tabular/components/StudioHeader";
import { PredictionForm } from "../tabular/components/PredictionForm";
import { VersionPanel } from "../tabular/components/VersionPanel";
import { EvaluationPanel } from "../tabular/components/EvaluationPanel";
export function TabularPredictPage({ id }: { id: string }) {
  const { value, error, loading, refresh } = useTabularProject(id);
  if (loading) return <p role="status">Loading CSV model…</p>;
  if (!value)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  const version =
    value.versions.find((v) => v.id === value.project.activeVersionId) ??
    value.versions[0];
  return (
    <>
      <StudioHeader
        id={id}
        title="Put your table’s learning to work."
        subtitle="Saved preprocessing and weights run locally. Use new, representative rows."
        step="predict"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="csv-layout">
        {version ? (
          <>
            <section className="notice">
              Active task: {version.artifact.config.task} · Target:{" "}
              {version.artifact.config.target}. CSV exports/imports are
              supported; online image-model sharing does not accept CSV
              artifacts.
            </section>
            <PredictionForm key={version.id} artifact={version.artifact} />
            <VersionPanel
              versions={value.versions}
              projectId={id}
              activeId={version.id}
              onActivated={refresh}
            />
            <EvaluationPanel artifact={version.artifact} />
          </>
        ) : (
          <div className="empty-state">
            <h2>No saved CSV model yet</h2>
            <p>
              Train a dataset, or import a supported CSV model from the studio
              home.
            </p>
            <a className="btn btn-primary" href={`#/tabular/${id}/train`}>
              Open CSV training
            </a>
          </div>
        )}
      </div>
    </>
  );
}
