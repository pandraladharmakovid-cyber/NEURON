import { useEffect, useRef, useState } from "react";
import type { Project, ModelVersion } from "../../lib/types";
import { errorMessage } from "../../lib/types";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { createShare } from "./sharing.service";
import { relayHealth } from "./relay-client";
import type { ShareReceipt } from "./receipt.repository";
import { downloadBlob } from "../../lib/download";
export function LinkShareDialog({
  project,
  version,
  onClose,
}: {
  project: Project;
  version: ModelVersion;
  onClose: () => void;
}) {
  const [consent, setConsent] = useState(false),
    [ttl, setTtl] = useState(3600),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [receipt, setReceipt] = useState<ShareReceipt | null>(null),
    [persisted, setPersisted] = useState(true),
    [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null),
    lock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    relayHealth(c.signal)
      .then((h) => {
        setReady(h.uploadsEnabled);
        if (!h.uploadsEnabled)
          setError("Relay uploads are disabled by the operator.");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e));
      });
    return () => {
      c.abort();
      abort.current?.abort();
    };
  }, []);
  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const c = new AbortController();
    abort.current = c;
    try {
      const result = await createShare(
        project,
        version,
        ttl,
        location.origin,
        c.signal,
      );
      setReceipt(result.receipt);
      setPersisted(result.persisted);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Share an encrypted model"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="share-dialog">
        {receipt ? (
          <>
            <p>
              The encrypted model is available until{" "}
              {new Date(receipt.expiresAt).toLocaleString()}. Anyone with the
              full link can decrypt it. Treat the link as a secret.
            </p>
            <label className="field">
              Share link
              <input
                className="secret-input"
                readOnly
                value={receipt.link}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="share-actions">
              <Button
                onClick={() => {
                  if (!navigator.clipboard) {
                    setError("Select and copy the link manually.");
                    return;
                  }
                  void navigator.clipboard
                    .writeText(receipt.link)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError(
                        "Clipboard access denied. Select and copy the link manually.",
                      ),
                    );
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadBlob(
                    new Blob([JSON.stringify(receipt)], {
                      type: "application/json",
                    }),
                    "neuron.neuron-share-receipt.json",
                  )
                }
              >
                Download deletion receipt
              </Button>
            </div>
            {!persisted && (
              <p role="alert" className="error">
                The receipt could not be saved locally. Download it NOW to
                retain the deletion token. Expiry still applies.
              </p>
            )}
            <p className="share-warning">
              The receipt contains BOTH the link and a separate deletion secret.
              Keep it private. Full project backups do not include these
              receipts. Revocation cannot erase copies already downloaded.
            </p>
            <a className="small-link" href="#/shares" onClick={onClose}>
              Manage links →
            </a>
          </>
        ) : (
          <>
            <p>
              Only the selected model, labels and preprocessing settings are
              encrypted and uploaded. Your project images and feedback are not
              included. The relay sees connection metadata, ciphertext size and
              expiry—not the decryption key.
            </p>
            <label className="field">
              Link lifetime
              <select
                value={ttl}
                disabled={busy}
                onChange={(e) => setTtl(Number(e.target.value))}
              >
                <option value={900}>15 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={86400}>24 hours</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              I approve uploading this encrypted model. I understand a trained
              model may reveal information about its training data.
            </label>
            <Button
              disabled={!consent || busy || !ready}
              onClick={() => void create()}
            >
              {busy ? "Encrypting / uploading…" : "Create share link"}
            </Button>
            {busy && (
              <Button variant="ghost" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            )}
            <p className="phase-note">
              Online relay required. If cancelled after the server receives an
              upload, an unconfirmed encrypted object may remain until expiry.
              Your training dataset is never uploaded by this workflow.
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}