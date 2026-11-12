import { useEffect, useRef, useState } from "react";
import { useTabularProject } from "../tabular/hooks/useTabularProject";
import { StudioHeader } from "../tabular/components/StudioHeader";
import { TrainingControls } from "../tabular/components/TrainingControls";
import { TrainingMonitor } from "../tabular/components/TrainingMonitor";
import { EvaluationPanel } from "../tabular/components/EvaluationPanel";
import { startTraining, type Job } from "../tabular/worker-client";
import type { Options, Progress, Artifact } from "../tabular/types";
import { DEFAULT_OPTIONS } from "../tabular/limits";
import { saveVersion } from "../tabular/repository";
import { message } from "../tabular/errors";
import { runActivity } from "../pwa/update-manager";
export function TabularTrainingPage({ id }: { id: string }) {
  const { value, error: loadError, loading } = useTabularProject(id),
    [options, setOptions] = useState<Options>({ ...DEFAULT_OPTIONS }),
    [progress, setProgress] = useState<Progress | null>(null),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [artifact, setArtifact] = useState<Artifact | null>(null);
  const job = useRef<Job<Artifact> | null>(null),
    alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    const before = (e: BeforeUnloadEvent) => {
      if (lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      alive.current = false;
      job.current?.cancel();
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  async function train() {
    if (lock.current || !value?.dataset || !value.project.config) return;
    lock.current = true;
    setRunning(true);
    setError("");
    setArtifact(null);
    setProgress(null);
    try {
      await runActivity(async () => {
        job.current = startTraining(
          { dataset: value.dataset!, config: value.project.config!, options },
          (p) => {
            if (alive.current) setProgress(p);
          },
        );
        const next = await job.current.result;
        if (!alive.current) return;
        await saveVersion(id, next);
        if (alive.current) setArtifact(next);
      });
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      lock.current = false;
      job.current = null;
      if (alive.current) setRunning(false);
    }
  }
  if (loading) return <p role="status">Loading training data…</p>;
  if (!value)
    return (
      <p className="error" role="alert">
        {loadError}
      </p>
    );
  return (
    <>
      <StudioHeader
        id={id}
        title="Teach your table to predict."
        subtitle="Real local worker training. Preprocessing fits training rows only; validation selects; test evaluates."
        step="train"
      />
      {(loadError || error) && (
        <p className="error" role="alert">
          {error || loadError}
        </p>
      )}
      {value.dataset && value.project.config ? (
        <div className="csv-training-grid">
          <TrainingControls
            options={options}
            onChange={setOptions}
            dataset={value.dataset}
            config={value.project.config}
            running={running}
            onStart={() => void train()}
            onCancel={() => job.current?.cancel()}
          />
          <TrainingMonitor progress={progress} running={running} />
        </div>
      ) : (
        <div className="empty-state">
          <h2>Configure a dataset first</h2>
          <p>Choose a target and feature columns before training.</p>
          <a className="btn btn-primary" href={`#/tabular/${id}`}>
            Open CSV dataset
          </a>
        </div>
      )}
      {artifact && (
        <>
          <section className="success">
            <h2>CSV model trained and saved</h2>
            <p>
              Best epoch {artifact.provenance.bestEpoch}. Prior versions remain
              available.
            </p>
            <a className="btn btn-primary" href={`#/tabular/${id}/predict`}>
              Try CSV model →
            </a>
          </section>
          <EvaluationPanel artifact={artifact} />
        </>
      )}
    </>
  );
}
