import { useEffect, useState } from "react";
import {
  approveFeedback,
  discardFeedback,
  listFeedback,
} from "./evolution.service";
import { type FeedbackItem, type Project, errorMessage } from "../../lib/types";
import { Button } from "../../components/ui/Button";
function ReviewImage({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <img
      className="review-image"
      src={url}
      alt="Feedback image awaiting approval"
    />
  );
}
export function FeedbackQueue({ project }: { project: Project }) {
  const [items, setItems] = useState<FeedbackItem[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function refresh() {
    setItems(await listFeedback(project.id));
  }
  useEffect(() => {
    void refresh().catch((e) => setError(errorMessage(e)));
  }, [project.id]);
  async function task(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Review queue · {items.length}/100</h2>
      <p>
        Approve adds an image to its chosen training class. Your saved model
        does not change until you retrain and activate a new version.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!items.length ? (
        <p className="muted">
          No pending feedback. Add a prediction image from the Predict page.
        </p>
      ) : (
        <div className="review-grid">
          {items.map((item) => (
            <article key={item.id}>
              <ReviewImage blob={item.blob} />
              <strong>
                {project.labels.find((l) => l.id === item.labelId)?.name ??
                  "Class removed"}
              </strong>
              <p>Predicted: {item.predictedLabel}</p>
              <div className="inline">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void task(async () => {
                      await approveFeedback(item.id);
                      setMessage("Added to the dataset. Retrain when ready.");
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void task(() => discardFeedback(item.id))}
                >
                  Discard
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <a className="btn btn-secondary" href={`#/projects/${project.id}/train`}>
        Retrain with approved examples
      </a>
    </section>
  );
}