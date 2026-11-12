import { useEffect, useState } from "react";
import {
  getRegistration,
  offlineState,
  subscribeOffline,
} from "../../pwa/register";
import { installUpdate } from "../../pwa/update-manager";
import { errorMessage } from "../../lib/types";
export function OfflineBanner({ tabular = false }: { tabular?: boolean }) {
  const [online, setOnline] = useState(navigator.onLine),
    [, render] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const unsub = subscribeOffline(() => render((n) => n + 1));
    return () => {
      unsub();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="notice offline-notice">
          You are offline. Saved projects remain local.{" "}
          {tabular
            ? "Numeric/media training and predictions need no encoder pack after the production shell is installed."
            : "Image training and predictions require the verified encoder pack."}{" "}
          <a href="#/settings">Check readiness →</a>
        </div>
      )}
      {offlineState.updateAvailable && (
        <div className="notice offline-notice">
          A new app version is ready. Save your work first.{" "}
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              const r = getRegistration();
              if (!r) return;
              setBusy(true);
              void installUpdate(r)
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setBusy(false));
            }}
          >
            Apply safe update
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
