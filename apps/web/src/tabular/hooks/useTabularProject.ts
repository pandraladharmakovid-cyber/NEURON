import { useCallback, useEffect, useRef, useState } from "react";
import { snapshot } from "../repository";
import type { Snapshot } from "../types";
import { message } from "../errors";
export function useTabularProject(id: string) {
  const [value, setValue] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await snapshot(id);
      if (alive.current) {
        setValue(next);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  return { value, error, loading, refresh };
}
