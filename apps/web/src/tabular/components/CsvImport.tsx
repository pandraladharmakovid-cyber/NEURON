import { useEffect, useRef, useState } from "react";
import { parseCSVFile, type Job } from "../worker-client";
import { datasetRecord } from "../profile";
import { replaceDataset } from "../repository";
import type { Dataset, ParsedCSV } from "../types";
import { message } from "../errors";
import { Button } from "../../components/ui/Button";
export function CsvImport({
  projectId,
  hasDataset,
  onImported,
}: {
  projectId: string;
  hasDataset: boolean;
  onImported: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null),
    job = useRef<Job<{ table: ParsedCSV; hash: string }> | null>(null),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => () => job.current?.cancel(), []);
  async function upload(file: File) {
    if (lock.current) return;
    if (
      hasDataset &&
      !confirm(
        "Replace the current CSV? Its training configuration will reset. Existing model versions remain available.",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      job.current = parseCSVFile(file);
      const result = await job.current.result;
      const dataset: Dataset = datasetRecord(
        projectId,
        file.name,
        result.table,
        result.hash,
      );
      await replaceDataset(dataset);
      await onImported();
    } catch (e) {
      setError(message(e));
    } finally {
      job.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{hasDataset ? "Replace CSV dataset" : "Bring your CSV data"}</h2>
      <p>
        Parsing happens in a local browser Worker. Your rows are not uploaded.
        Choose comma-separated UTF-8 CSV with a header row.
      </p>
      <input
        ref={input}
        type="file"
        hidden
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="csv-upload-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Parsing / saving CSV…" : "Choose CSV file"}
        </Button>
        {busy && (
          <Button variant="danger" onClick={() => job.current?.cancel()}>
            Cancel CSV import
          </Button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="phase-note">
        Max 16 MB · 25,000 rows · 100 columns · 500,000 cells. CSV studio
        data/backups are separate from image projects. Keep your source files
        backed up.
      </p>
    </section>
  );
}
