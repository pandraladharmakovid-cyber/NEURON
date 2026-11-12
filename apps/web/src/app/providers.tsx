import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
export type Preferences = { cameraEnabled: boolean; reducedMotion: boolean };
export const PREFERENCE_KEY = "neuron-preferences-v1";
export const DEFAULT_PREFERENCES: Preferences = {
  cameraEnabled: true,
  reducedMotion: false,
};
export function decodePreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw ?? "null");
    if (
      p &&
      typeof p.cameraEnabled === "boolean" &&
      typeof p.reducedMotion === "boolean"
    )
      return { cameraEnabled: p.cameraEnabled, reducedMotion: p.reducedMotion };
  } catch {}
  return { ...DEFAULT_PREFERENCES };
}
function read() {
  try {
    return decodePreferences(localStorage.getItem(PREFERENCE_KEY));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
const Context = createContext<{
  preferences: Preferences;
  update: (next: Preferences) => void;
  storageWarning: string;
}>({
  preferences: DEFAULT_PREFERENCES,
  update: () => {
    throw new Error("Preferences provider missing.");
  },
  storageWarning: "",
});
export function Providers({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(read),
    [storageWarning, setStorageWarning] = useState("");
  const update = useCallback((next: Preferences) => {
    const safe = decodePreferences(JSON.stringify(next));
    setPreferences(safe);
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify(safe));
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Preferences apply to this tab only because browser preference storage is blocked. Your project storage is separate.",
      );
    }
  }, []);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === PREFERENCE_KEY || e.key === null) setPreferences(read());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(
      preferences.reducedMotion,
    );
  }, [preferences.reducedMotion]);
  return (
    <Context.Provider value={{ preferences, update, storageWarning }}>
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  return useContext(Context);
}
