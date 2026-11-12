import { useTabularProject } from "../tabular/hooks/useTabularProject";
import { StudioHeader } from "../tabular/components/StudioHeader";
import { CsvImport } from "../tabular/components/CsvImport";
import { DataPreview } from "../tabular/components/DataPreview";
import { ColumnConfig } from "../tabular/components/ColumnConfig";
export function TabularDatasetPage({ id }: { id: string }) {
  const { value, error, loading, refresh } = useTabularProject(id);
  if (loading) return <p role="status">Loading CSV project…</p>;
  if (!value)
    return (
      <p className="error" role="alert">
        {error || "CSV project not found."}
      </p>
    );
  return (
    <>
      <StudioHeader
        id={id}
        title={value.project.name}
        subtitle="Import a CSV, review columns, then choose the target and features."
        step="data"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="csv-layout">
        <CsvImport
          projectId={id}
          hasDataset={!!value.dataset}
          onImported={refresh}
        />
        {value.dataset && (
          <>
            <DataPreview dataset={value.dataset} />
            <ColumnConfig
              key={value.dataset.hash}
              dataset={value.dataset}
              initial={value.project.config}
              onSaved={refresh}
            />
            <div>
              <a
                className={`btn btn-primary ${!value.project.config ? "disabled" : ""}`}
                aria-disabled={!value.project.config}
                href={
                  value.project.config ? `#/tabular/${id}/train` : undefined
                }
              >
                Continue to CSV training →
              </a>
            </div>
          </>
        )}
        {value.versions.length > 0 && (
          <p>
            <a className="small-link" href={`#/tabular/${id}/predict`}>
              Use your saved CSV model →
            </a>
          </p>
        )}
      </div>
    </>
  );
}
