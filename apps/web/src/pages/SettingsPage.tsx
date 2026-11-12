import { useState } from "react";
import { capabilities } from "../lib/capabilities";
import { RuntimeSettings } from "../features/settings/RuntimeSettings";
import { BackupPanel } from "../features/settings/BackupPanel";
import { TabularBackupPanel } from "../tabular/components/BackupPanel";
import { PrivacySettings } from "../features/settings/PrivacySettings";
import { StorageManager } from "../features/settings/StorageManager";
import { ImportDialog } from "../features/sharing/ImportDialog";
import { Button } from "../components/ui/Button";
export function SettingsPage() {
  const support = capabilities(),
    [importing, setImporting] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR RULES</div>
          <h1>Privacy & storage</h1>
          <p>Understand what stays here—and what needs a backup.</p>
        </div>
      </div>
      <section className="panel sharing-settings">
        <h2>Encrypted model sharing</h2>
        <p>
          Create expiring IMAGE-model links from a saved model’s Predict page.
          An optional relay stores ciphertext—not your dataset. Keep the
          deletion receipt to revoke a link before expiry. CSV models use local
          export/import only.
        </p>
        <a className="btn btn-secondary" href="#/shares">
          Manage encrypted links
        </a>
      </section>
      <div className="settings-grid">
        <TabularBackupPanel />
        <RuntimeSettings />
        <BackupPanel />
        <StorageManager />
        <PrivacySettings />
        <section className="panel">
          <h2>Import an image model safely</h2>
          <p className="muted">
            Validated NEURON numeric image models only, maximum 8 MB. Imported
            as a NEW project, without deleting existing examples or changing
            another project's class vocabulary.
          </p>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import image model as new project
          </Button>
          <p className="phase-note">
            Model import does not restore raw training images. Full image/CSV
            project backups are separate formats. Imported validation metrics
            are author claims, not independently authenticated scores.
          </p>
        </section>
        <section className="panel">
          <h2>Device capabilities</h2>
          <dl className="summary-list">
            <div>
              <dt>IndexedDB</dt>
              <dd>{support.storage ? "Available" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Camera API</dt>
              <dd>{support.camera ? "Available" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Secure context</dt>
              <dd>{support.secure ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>WebGPU API</dt>
              <dd>{support.webgpu ? "Detected (not used)" : "Not detected"}</dd>
            </div>
            <div>
              <dt>Image normalization worker</dt>
              <dd>
                {typeof Worker !== "undefined" &&
                typeof OffscreenCanvas !== "undefined"
                  ? "Available; DOM canvas fallback otherwise"
                  : "DOM canvas fallback"}
              </dd>
            </div>
          </dl>
          <p className="phase-note">
            Image training/inference use WebGL or CPU on the page, not dedicated
            training workers or WebGPU. CSV training/parsing and supported image
            normalization use dedicated workers. API detection is not
            performance certification.
          </p>
        </section>
        <section className="panel">
          <h2>The local-first promise</h2>
          <ul className="privacy-list">
            <li>No account or application training backend.</li>
            <li>No analytics or automatic raw dataset uploads. Audio recording requires explicit microphone consent.</li>
            <li>
              Image encoder weights download from Google-hosted model endpoints
              only when explicitly installed/needed.
            </li>
            <li>
              Sharing/export is an explicit user action, not automatic
              synchronization.
            </li>
            <li>
              Private mode, quota limits and storage eviction can remove local
              data.
            </li>
            <li>
              Offline CSV training requires an installed production shell.
              Images additionally need the verified encoder pack. Encrypted
              links require the optional online sharing relay.
            </li>
          </ul>
        </section>
      </div>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}
