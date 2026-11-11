import { useEffect, useRef, useState } from "react";
import {
  receiveShare,
  importReceived,
} from "../features/sharing/sharing.service";
import type { SharedModel } from "../features/sharing/share-format";
import { errorMessage } from "../lib/types";
import { Button } from "../components/ui/Button";
export function ReceivePage({ id, secret }: { id: string; secret: string }) {
  const [key, setKey] = useState(secret),
    [consent, setConsent] = useState(false),
    [model, setModel] = useState<SharedModel | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    lock = useRef(false);
  useEffect(() => {
    if (secret) {
      setKey(secret);
      setModel(null);
      setError("");
    }
    if (secret)
      history.replaceState(
        null,
        "",
        location.pathname + location.search + "#/receive/" + id,
      );
    return () => abort.current?.abort();
  }, [id, secret]);
  async function inspect() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const c = new AbortController();
    abort.current = c;
    try {
      setModel(await receiveShare(id, key, c.signal));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel receive-panel">
      <div className="eyebrow">ENCRYPTED MODEL TRANSFER</div>
      <h1>A model, shared with you.</h1>
      <p>
        No account needed. Download ciphertext and decrypt it locally, then
        choose whether to import the validated model. No dataset is included.
      </p>
      <p className="share-warning">
        Only open models from people you trust. Imported weights are schema/size
        checked and cannot supply executable graph code, but predictions may be
        wrong or harmful. The relay still sees your connection metadata.
      </p>
      {!model ? (
        <>
          <label className="field">
            Decryption key
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              maxLength={43}
            />
          </label>
          <p className="phase-note">
            The incoming key was removed from the visible address bar and kept
            in memory. Keep the original secret link if you need to reopen it;
            reloading this page clears the key.
          </p>
          <Button
            disabled={busy || key.length !== 43}
            onClick={() => void inspect()}
          >
            {busy ? "Downloading / decrypting…" : "Inspect shared model"}
          </Button>
          {busy && (
            <Button variant="ghost" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          )}
        </>
      ) : (
        <>
          <dl className="share-details">
            <dt>Name</dt>
            <dd>{model.name}</dd>
            <dt>Type</dt>
            <dd>Image classifier · MobileNet v2</dd>
            <dt>Classes</dt>
            <dd>{model.artifact.labels.map((l) => l.name).join(", ")}</dd>
            <dt>Validation</dt>
            <dd>
              {(model.artifact.evaluation.accuracy * 100).toFixed(1)}% on{" "}
              {model.artifact.evaluation.total} images (sender-provided, not
              independently verified)
            </dd>
          </dl>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Import this model as a NEW local project. Do not overwrite my
            existing projects.
          </label>
          <Button
            disabled={!consent || busy}
            onClick={() => {
              setBusy(true);
              void importReceived(model)
                .then((p) => {
                  location.hash = "/projects/" + p.id + "/predict";
                })
                .catch((e) => {
                  setError(errorMessage(e));
                  setBusy(false);
                });
            }}
          >
            Import as new project
          </Button>
          <p className="phase-note">
            Predictions need a verified local encoder pack. If missing, install
            it in Settings. A received model has no training images; add your
            own before retraining.
          </p>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}