import { useState } from "react";
import type { Project } from "../../lib/types";
import { errorMessage } from "../../lib/types";
import { queueFeedback } from "../evolution/evolution.service";
import { Button } from "../../components/ui/Button";
export function FeedbackCapture({
  project,
  versionId,
  blob,
  predictedLabel,
}: {
  project: Project;
  versionId: string;
  blob: Blob;
  predictedLabel: string;
}) {
  const [label, setLabel] = useState(project.labels[0]?.id ?? ""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="feedback-capture">
      <h3>Teach it from this prediction</h3>
      <p>
        Choose the correct class. With your permission, save this image to a
        local review queue. No automatic retraining or uploads.
      </p>
      <label className="field">
        Correct class
        <select value={label} onChange={(e) => setLabel(e.target.value)}>
          {project.labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        Save this image locally for review.
      </label>
      <Button
        variant="secondary"
        disabled={!consent || busy}
        onClick={() => {
          setBusy(true);
          void queueFeedback(project.id, versionId, label, blob, predictedLabel)
            .then(() => {
              setMessage("Saved to the review queue.");
              setConsent(false);
            })
            .catch((e) => setMessage(errorMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        Add to review queue
      </Button>
      <p role="status">{message}</p>
      <a className="small-link" href={`#/projects/${project.id}/evolve`}>
        Review feedback & model history →
      </a>
    </section>
  );
}