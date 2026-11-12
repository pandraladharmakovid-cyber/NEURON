import { usePreferences, DEFAULT_PREFERENCES } from "../../app/providers";
import { Button } from "../../components/ui/Button";
export function PrivacySettings() {
  const { preferences, update, storageWarning } = usePreferences();
  return (
    <section className="panel">
      <h2>Privacy controls</h2>
      <p>
        No analytics, background dataset uploads or microphone capture are
        enabled. These two preferences affect this application only; they do not
        change your browser's OS/site permissions.
      </p>
      <label className="privacy-toggle">
        <input
          type="checkbox"
          checked={preferences.cameraEnabled}
          onChange={(e) =>
            update({ ...preferences, cameraEnabled: e.target.checked })
          }
        />
        <span>
          Allow camera controls in NEURON. Turning this off immediately stops
          this tab’s active camera; changes propagate to other same-origin tabs.
          The browser still asks for permission when you choose Use camera.
        </span>
      </label>
      <label className="privacy-toggle">
        <input
          type="checkbox"
          checked={preferences.reducedMotion}
          onChange={(e) =>
            update({ ...preferences, reducedMotion: e.target.checked })
          }
        />
        <span>
          Reduce application motion. Suppress animations/transitions and smooth
          scrolling. This does not pause actual training jobs.
        </span>
      </label>
      {storageWarning && (
        <p className="notice" role="status">
          {storageWarning}
        </p>
      )}
      <Button
        variant="ghost"
        onClick={() => update({ ...DEFAULT_PREFERENCES })}
      >
        Reset preferences only
      </Button>
      <p className="phase-note">
        Reset does NOT erase projects, images, CSV rows, encoder packs, models
        or deletion receipts. Browser/site-data reset is destructive. Export
        private full project backups before changing storage settings.
      </p>
    </section>
  );
}
