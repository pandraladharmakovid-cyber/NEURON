import { useEffect, useRef, useState } from "react";
import { getProject, listVersions, activateVersion } from "../../lib/db";
import type { Project, ModelVersion, Prediction } from "../../lib/types";
import { predictor } from "./inference.service";
import { normalizeImage } from "../datasets/dataset.service";
import { explainError } from "../../lib/errors";
import { runActivity } from "../../pwa/update-manager";
export function useImageInference(id: string) {
  const [project, setProject] = useState<Project | null>(null),
    [versions, setVersions] = useState<ModelVersion[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [results, setResults] = useState<Prediction[]>([]),
    [preview, setPreview] = useState(""),
    [feedbackBlob, setFeedbackBlob] = useState<Blob | null>(null),
    [latency, setLatency] = useState(0),
    [loading, setLoading] = useState(true);
  const alive = useRef(true),
    inFlight = useRef(false),
    engine = useRef<Awaited<ReturnType<typeof predictor>> | null>(null),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    Promise.all([getProject(id), listVersions(id)])
      .then(([p, v]) => {
        if (alive.current) {
          setProject(p ?? null);
          setVersions(v);
          setSelected(p?.activeVersionId ?? v[0]?.id ?? "");
          if (!p) setError("Project not found.");
        }
      })
      .catch((e) => {
        if (alive.current) setError(explainError(e).message);
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [id]);
  useEffect(() => {
    let cancelled = false;
    const ticket = ++generation.current;
    setReady(false);
    setResults([]);
    setFeedbackBlob(null);
    setPreview("");
    const version = versions.find((v) => v.id === selected);
    if (!version) return;
    void predictor(version.artifact)
      .then((p) => {
        if (cancelled || !alive.current || ticket !== generation.current)
          p.dispose();
        else {
          engine.current = p;
          setReady(true);
        }
      })
      .catch((e) => {
        if (!cancelled && alive.current) setError(explainError(e).message);
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [selected, versions]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function fromFile(files: File[]) {
    if (!files[0] || !engine.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const ticket = generation.current,
      start = performance.now(),
      current = engine.current;
    try {
      await runActivity(async () => {
        const blob = await normalizeImage(files[0]);
        const predictions = await current.predict(blob);
        if (alive.current && ticket === generation.current) {
          setResults(predictions);
          setLatency(performance.now() - start);
          setFeedbackBlob(blob);
          setPreview(URL.createObjectURL(blob));
        }
      });
    } catch (e) {
      if (alive.current && ticket === generation.current)
        setError(explainError(e).message);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function makeActive() {
    if (!project || busy) return;
    try {
      await activateVersion(id, selected);
      if (alive.current) setProject({ ...project, activeVersionId: selected });
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    }
  }
  return {
    project,
    versions,
    selected,
    setSelected,
    error,
    busy,
    ready,
    results,
    preview,
    feedbackBlob,
    latency,
    loading,
    fromFile,
    makeActive,
  };
}
