import { useCallback, useEffect, useRef, useState } from "react";
import { listProjects, deleteProject } from "../../lib/db";
import type { Project } from "../../lib/types";
import { explainError } from "../../lib/errors";
export function useProjects() {
  const [items, setItems] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    lock = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const p = await listProjects();
      if (alive.current) setItems(p);
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const focus = () => {
      if (!lock.current) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  async function remove(project: Project) {
    if (
      lock.current ||
      !confirm(
        `Permanently delete “${project.name}”, its images and all model versions? This cannot be undone. Export a full backup first.`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await deleteProject(project.id);
      await refresh();
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return { items, loading, busy, error, refresh, remove };
}
