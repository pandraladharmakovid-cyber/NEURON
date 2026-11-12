import { runActivity } from "../../pwa/update-manager";
import { useEffect, useRef, useState } from "react";
import { getProject, listSamples, commitVersion } from "../../lib/db";
import { train, type TrainingProgress } from "./training.service";
import {
  type Project,
  type Sample,
  type ModelArtifact,
  errorMessage,
  uid,
} from "../../lib/types";
export function useImageTraining(id: string) {
  const [project, setProject] = useState<Project | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [error, setError] = useState(""),
    [epochs, setEpochs] = useState(20),
    [rate, setRate] = useState(0.001),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState<TrainingProgress | null>(null),
    [result, setResult] = useState<ModelArtifact | null>(null);
  const controller = useRef<AbortController | null>(null),
    alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    Promise.all([getProject(id), listSamples(id)])
      .then(([p, s]) => {
        if (alive.current) {
          if (!p) setError("Project not found.");
          setProject(p ?? null);
          setSamples(s);
        }
      })
      .catch((e) => {
        if (alive.current) setError(errorMessage(e));
      });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function start() {
    if (!project || lock.current) return;
    lock.current = true;
    setRunning(true);
    setError("");
    setResult(null);
    setProgress(null);
    const c = new AbortController();
    controller.current = c;
    try {
      await runActivity(async () => {
        const artifact = await train(
          project,
          samples,
          { epochs, learningRate: rate, seed: 42 },
          c.signal,
          (p) => {
            if (alive.current) setProgress(p);
          },
        );
        if (c.signal.aborted) return;
        await commitVersion(
          { id: uid(), projectId: id, artifact, createdAt: Date.now() },
          {
            labels: project.labels,
            samples: samples.map((s) => ({ id: s.id, labelId: s.labelId })),
          },
        );
        if (alive.current) setResult(artifact);
      });
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof DOMException && e.name === "AbortError"
            ? "Training cancelled. The previous saved model is unchanged."
            : errorMessage(e),
        );
    } finally {
      lock.current = false;
      if (alive.current) setRunning(false);
      controller.current = null;
    }
  }

  const ready =
    !!project &&
    project.labels.every(
      (l) => samples.filter((s) => s.labelId === l.id).length >= 5,
    );
  return {
    project,
    samples,
    error,
    epochs,
    setEpochs,
    rate,
    setRate,
    running,
    progress,
    result,
    ready,
    start,
    cancel: () => controller.current?.abort(),
  };
}
