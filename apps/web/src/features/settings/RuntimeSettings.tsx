import { useEffect, useRef, useState } from "react";
import { packStatus, downloadPack, removePack } from "../../pwa/asset-manager";
import {
  getRegistration,
  offlineState,
  subscribeOffline,
} from "../../pwa/register";
import { bytes } from "../../lib/capabilities";
import { errorMessage } from "../../lib/types";
import { Button } from "../../components/ui/Button";
export function RuntimeSettings() {
  const [status, setStatus] = useState({ ready: false, bytes: 0, error: "" }),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [, render] = useState(0);
  const control = useRef<AbortController | null>(null);
  useEffect(() => {
    void packStatus().then(setStatus);
    const unsubscribe = subscribeOffline(() => render((n) => n + 1));
    return () => {
      unsubscribe();
      control.current?.abort();
    };
  }, []);
  async function download() {
    setBusy(true);
    setError("");
    const c = new AbortController();
    control.current = c;
    try {
      await downloadPack(c.signal, (done, total) => setProgress(done / total));
      setStatus(await packStatus());
    } catch (e) {
      setError(
        c.signal.aborted
          ? "Download cancelled. No incomplete pack was installed."
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
      control.current = null;
    }
  }
  return (
    <section className="panel">
      <h2>Offline readiness</h2>
      <dl className="summary-list">
        <div>
          <dt>Application shell</dt>
          <dd>
            {offlineState.controlled
              ? "Installed"
              : import.meta.env.DEV
                ? "Development mode"
                : "Installing / unavailable"}
          </dd>
        </div>
        <div>
          <dt>Image encoder</dt>
          <dd>
            {status.ready ? `Verified · ${bytes(status.bytes)}` : "Not ready"}
          </dd>
        </div>
      </dl>
      <p>
        Both the production app shell and verified encoder must be installed
        before disconnecting. Storage can still be cleared or evicted by your
        browser.
      </p>
      {busy ? (
        <>
          <progress value={progress} max={1} />
          <Button variant="danger" onClick={() => control.current?.abort()}>
            Cancel download
          </Button>
        </>
      ) : (
        <div className="inline wrap">
          <Button disabled={status.ready} onClick={() => void download()}>
            Download image encoder (~14 MB)
          </Button>
          <Button
            variant="secondary"
            disabled={!status.ready}
            onClick={() => {
              if (
                confirm(
                  "Remove the cached encoder? Existing models and images remain, but future page sessions need another download.",
                )
              )
                void removePack()
                  .then(() => packStatus())
                  .then(setStatus)
                  .catch((e) => setError(errorMessage(e)));
            }}
          >
            Remove encoder pack
          </Button>
          <Button
            variant="ghost"
            onClick={() => void packStatus().then(setStatus)}
          >
            Verify pack
          </Button>
        </div>
      )}
      {(error || status.error || offlineState.error) && (
        <p role="alert" className="error">
          {error || status.error || offlineState.error}
        </p>
      )}
      <Button
        variant="ghost"
        onClick={() =>
          void getRegistration()
            ?.update()
            .catch((e) => setError(errorMessage(e)))
        }
      >
        Check for app update
      </Button>
      <p className="phase-note">
        Offline reload works in a production build only: pnpm build, then pnpm
        --filter @neuron/web preview. Open localhost:4173, wait for shell
        installation and download the encoder. Development Vite sessions
        deliberately do not install a service worker.
      </p>
    </section>
  );
}