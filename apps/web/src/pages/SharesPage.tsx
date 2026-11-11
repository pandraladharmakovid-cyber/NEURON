import { useEffect, useRef, useState } from "react";
import {
  listReceipts,
  forgetReceipt,
  importReceipt,
  type ShareReceipt,
} from "../features/sharing/receipt.repository";
import { revokeShare } from "../features/sharing/sharing.service";
import { relayHealth } from "../features/sharing/relay-client";
import { Button } from "../components/ui/Button";
import { errorMessage } from "../lib/types";
import { downloadBlob } from "../lib/download";
export function SharesPage() {
  const [items, setItems] = useState<ShareReceipt[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [health, setHealth] = useState("Not checked"),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refresh = async () => setItems(await listReceipts());
  useEffect(() => {
    void refresh().catch((e) => setError(errorMessage(e)));
  }, []);
  async function task(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OPTIONAL ONLINE DISTRIBUTION</div>
          <h1>Encrypted share links</h1>
          <p>
            Local deletion receipts give you control without an account. Expiry
            is enforced by the relay.
          </p>
        </div>
        <a className="btn btn-secondary" href="#/projects">
          Choose a project
        </a>
      </div>
      <div className="share-health">
        <span className="share-status">Relay: {health}</span>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void task(async () => {
              const h = await relayHealth();
              setHealth(h.uploadsEnabled ? "Available" : "Uploads disabled");
            })
          }
        >
          Check relay
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Import deletion receipt
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void task(async () => {
              await importReceipt(file, location.origin);
              setMessage("Receipt imported.");
            });
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <p className="share-warning">
        Receipts contain sensitive access and deletion capabilities. They are
        stored separately from projects and are not included in project backups.
        Deleting a project does not revoke its links. Forgetting a receipt does
        not delete the remote object. Download receipts before clearing browser
        storage.
      </p>
      {!items.length && (
        <div className="empty-state">
          <h2>No saved share receipts</h2>
          <p>
            Open a trained model’s Predict page and choose Create encrypted
            share link.
          </p>
        </div>
      )}
      {items.map((r) => (
        <article className="share-card" key={r.id}>
          <div className="section-heading">
            <h3>{r.name}</h3>
            <span className="share-status">
              {r.expiresAt <= Date.now() ? "Expired" : "Expiring link"}
            </span>
          </div>
          <p>
            Expires {new Date(r.expiresAt).toLocaleString()}. Reference: {r.id}
          </p>
          <input
            className="secret-input"
            aria-label={`Share link for ${r.name}`}
            value={r.link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <div className="share-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (!navigator.clipboard) {
                  setError("Select and copy the link manually.");
                  return;
                }
                void navigator.clipboard
                  .writeText(r.link)
                  .then(() => setMessage("Link copied."))
                  .catch(() =>
                    setError("Clipboard denied. Select and copy manually."),
                  );
              }}
            >
              Copy link
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(r)], { type: "application/json" }),
                  "neuron.neuron-share-receipt.json",
                )
              }
            >
              Download receipt
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Revoke this remote encrypted model? Already downloaded copies cannot be removed.",
                  )
                )
                  void task(async () => {
                    await revokeShare(r, location.origin);
                    setMessage(
                      "Remote link revoked and local receipt removed.",
                    );
                  });
              }}
            >
              Revoke remote link
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Forget the LOCAL receipt only? This does NOT revoke the remote model. You may lose early-deletion access.",
                  )
                )
                  void task(() => forgetReceipt(r.id));
              }}
            >
              Forget local receipt
            </Button>
          </div>
        </article>
      ))}
    </>
  );
}