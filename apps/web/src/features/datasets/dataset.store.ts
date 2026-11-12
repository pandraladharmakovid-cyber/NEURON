import { useCallback, useEffect, useRef, useState } from "react";
import {
  snapshotProject,
  database,
  trackTransaction,
  deleteLabel,
} from "../../lib/db";
import { cleanName } from "../projects/project.service";
import { addImages, removeSample } from "./dataset.service";
import type { Project, Sample } from "../../lib/types";
import { uid } from "../../lib/types";
import { explainError, requireCondition } from "../../lib/errors";
import { runActivity } from "../../pwa/update-manager";
export async function changeClass(
  projectId: string,
  change:
    | { kind: "add"; name: string }
    | { kind: "rename"; id: string; name: string },
) {
  const name = cleanName(change.name),
    db = await database(),
    tx = trackTransaction(db.transaction("projects", "readwrite")),
    p = await tx.store.get(projectId);
  requireCondition(p, "Project was deleted.");
  requireCondition(
    !p.labels.some(
      (l) =>
        (change.kind === "add" || l.id !== change.id) &&
        l.name.toLowerCase() === name.toLowerCase(),
    ),
    "Class name already exists.",
  );
  if (change.kind === "add")
    requireCondition(p.labels.length < 20, "At most 20 classes are supported.");
  else
    requireCondition(
      p.labels.some((l) => l.id === change.id),
      "Class was deleted in another tab.",
    );
  const labels =
    change.kind === "add"
      ? [...p.labels, { id: uid(), name }]
      : p.labels.map((l) => (l.id === change.id ? { ...l, name } : l));
  await tx.store.put({ ...p, labels, updatedAt: Date.now() });
  await tx.done;
}
export function useDataset(id: string) {
  const [project, setProject] = useState<Project | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const alive = useRef(true),
    lock = useRef(false),
    request = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++request.current;
    try {
      const s = await snapshotProject(id);
      if (alive.current && ticket === request.current) {
        setProject(s.project);
        setSamples(s.samples);
      }
    } catch (e) {
      if (alive.current && ticket === request.current)
        setError(explainError(e).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      request.current++;
    };
  }, [refresh]);
  async function mutate(action: () => Promise<unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await runActivity(action);
      if (alive.current) await refresh();
      return true;
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function upload(labelId: string, files: File[]) {
    if (!files.length) return;
    await mutate(async () => {
      const result = await addImages(
        id,
        labelId,
        files,
        samples.length,
        (n) => {
          if (alive.current) setStatus(`Saved ${n} of ${files.length} images`);
        },
      );
      if (alive.current) {
        setStatus(`Added ${result.saved} images.`);
        if (result.errors.length)
          setError(result.errors.slice(0, 5).join("\n"));
      }
    });
  }
  return {
    project,
    samples,
    loading,
    busy,
    error,
    status,
    refresh,
    upload,
    rename: (labelId: string, name: string) =>
      mutate(() => changeClass(id, { kind: "rename", id: labelId, name })),
    add: (name: string) => mutate(() => changeClass(id, { kind: "add", name })),
    remove: (sampleId: string) => mutate(() => removeSample(sampleId)),
    deleteClass: (labelId: string) =>
      mutate(async () => {
        requireCondition(project, "Project not found.");
        await deleteLabel(project, labelId);
      }),
  };
}
