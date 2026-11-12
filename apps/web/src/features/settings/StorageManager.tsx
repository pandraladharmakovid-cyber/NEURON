import {multiDB,multiProjects} from '../multimodal/repository';
import {validateMultiModel} from '../multimodal/model';
import {listCustom} from '../custom/model';
import { useEffect, useRef, useState } from "react";
import { database, trackTransaction } from "../../lib/db";
import { tabularDB, track } from "../../tabular/database";
import { listReceipts } from "../sharing/receipt.repository";
import { storageInfo, bytes } from "../../lib/capabilities";
import { sha256 } from "../../lib/checksums";
import { validateArtifact } from "../../lib/model-format";
import { validateTabularModel } from "../../tabular/model-format";
import { validateTable } from "../../tabular/schema";
import {
  runActivity,
  activeJobs,
  subscribeJobs,
} from "../../pwa/update-manager";
import { explainError } from "../../lib/errors";
import { downloadBlob } from "../../lib/download";
import { Button } from "../../components/ui/Button";
export type Inventory = {
  media?:{projects:number;examples:number;versions:number;blobBytes:number};
  customModels?:number;
  image: {
    projects: number;
    samples: number;
    versions: number;
    feedback: number;
    blobBytes: number;
  };
  tabular: {
    projects: number;
    datasets: number;
    rows: number;
    versions: number;
  };
  receipts: number;
  originStorage: { usage: number; quota: number; persistent: boolean };
};
export async function localInventory(): Promise<Inventory> {
  const images = await database(),
    tx = trackTransaction(
      images.transaction(
        ["projects", "samples", "versions", "feedback"],
        "readonly",
      ),
    );
  const [projects, samples, versions, feedback] = await Promise.all([
    tx.objectStore("projects").count(),
    tx.objectStore("samples").getAll(),
    tx.objectStore("versions").count(),
    tx.objectStore("feedback").getAll(),
  ]);
  await tx.done;
  const csv = await tabularDB(),
    tab = track(
      csv.transaction(["projects", "datasets", "versions"], "readonly"),
    );
  const [tabProjects, datasets, tabVersions] = await Promise.all([
    tab.objectStore("projects").count(),
    tab.objectStore("datasets").getAll(),
    tab.objectStore("versions").count(),
  ]);
  await tab.done;
  const mediaDB=await multiDB(),media=mediaDB.transaction(['projects','examples','versions'],'readonly');
  const [mediaProjects,mediaExamples,mediaVersions]=await Promise.all([media.objectStore('projects').count(),media.objectStore('examples').getAll(),media.objectStore('versions').count()]);await media.done;
  return {
    media:{projects:mediaProjects,examples:mediaExamples.length,versions:mediaVersions,blobBytes:mediaExamples.reduce((sum,e)=>sum+(e.blob?.size??(e.text?.length??0)*3),0)},customModels:(await listCustom()).length,
    image: {
      projects,
      samples: samples.length,
      versions,
      feedback: feedback.length,
      blobBytes: [...samples, ...feedback].reduce(
        (sum, s) => sum + s.blob.size,
        0,
      ),
    },
    tabular: {
      projects: tabProjects,
      datasets: datasets.length,
      rows: datasets.reduce((sum, d) => sum + d.rows.length, 0),
      versions: tabVersions,
    },
    receipts: (await listReceipts()).length,
    originStorage: await storageInfo(),
  };
}
export type IntegrityResult = {
  checked: number;
  issues: string[];
  complete: boolean;
};
export async function inspectLocalIntegrity(
  signal: AbortSignal,
  onProgress: (text: string) => void = () => {},
): Promise<IntegrityResult> {
  return runActivity(async () => {
    const result: IntegrityResult = { checked: 0, issues: [], complete: false };
    let sequence = 0;
    const check = async () => {
      signal.throwIfAborted();
      if (++sequence % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      signal.throwIfAborted();
    };
    const issue = (text: string) => {
      if (result.issues.length < 100) result.issues.push(text);
    };
    const db = await database(),
      tx = trackTransaction(
        db.transaction(
          ["projects", "samples", "versions", "feedback"],
          "readonly",
        ),
      );
    const [projects, samples, versions, feedback] = await Promise.all([
      tx.objectStore("projects").getAll(),
      tx.objectStore("samples").getAll(),
      tx.objectStore("versions").getAll(),
      tx.objectStore("feedback").getAll(),
    ]);
    await tx.done;
    const projectMap = new Map(projects.map((p) => [p.id, p])),
      versionMap = new Map(versions.map((v) => [v.id, v]));
    onProgress("Checking image project references…");
    for (const p of projects) {
      await check();
      result.checked++;
      if (
        p.activeVersionId &&
        versionMap.get(p.activeVersionId)?.projectId !== p.id
      )
        issue("An image project references a missing/foreign active model.");
    }
    for (const sample of samples) {
      await check();
      result.checked++;
      const p = projectMap.get(sample.projectId);
      if (!p || !p.labels.some((l) => l.id === sample.labelId))
        issue("An image sample has a missing project/class reference.");
      if (sample.hash && (await sha256(sample.blob)) !== sample.hash)
        issue("An image sample checksum does not match its stored content.");
    }
    for (const v of versions) {
      await check();
      result.checked++;
      if (!projectMap.has(v.projectId))
        issue("An image model has a missing project reference.");
      try {
        validateArtifact(v.artifact);
      } catch {
        issue("An image model failed numeric format validation.");
      }
    }
    for (const f of feedback) {
      await check();
      result.checked++;
      const p = projectMap.get(f.projectId);
      if (
        !p ||
        !p.labels.some((l) => l.id === f.labelId) ||
        versionMap.get(f.versionId)?.projectId !== f.projectId
      )
        issue("A feedback item has a missing project/class/model reference.");
    }
    onProgress("Checking CSV datasets and saved model formats…");
    const csv = await tabularDB(),
      tab = track(
        csv.transaction(["projects", "datasets", "versions"], "readonly"),
      );
    const [tables, datasets, models] = await Promise.all([
      tab.objectStore("projects").getAll(),
      tab.objectStore("datasets").getAll(),
      tab.objectStore("versions").getAll(),
    ]);
    await tab.done;
    const tableIds = new Set(tables.map((p) => p.id)),
      modelsById = new Map(models.map((v) => [v.id, v]));
    for (const p of tables) {
      await check();
      result.checked++;
      if (
        p.activeVersionId &&
        modelsById.get(p.activeVersionId)?.projectId !== p.id
      )
        issue("A CSV project references a missing/foreign active model.");
    }
    for (const d of datasets) {
      await check();
      result.checked++;
      if (!tableIds.has(d.projectId))
        issue("A CSV dataset has a missing project reference.");
      try {
        validateTable(d);
        if (
          (await sha256(
            JSON.stringify({ headers: d.headers, rows: d.rows }),
          )) !== d.hash
        )
          issue("A CSV dataset checksum does not match its stored content.");
      } catch {
        issue("A CSV dataset failed schema validation.");
      }
    }
    for (const v of models) {
      await check();
      result.checked++;
      if (!tableIds.has(v.projectId))
        issue("A CSV model has a missing project reference.");
      try {
        validateTabularModel(v.artifact);
      } catch {
        issue("A CSV model failed numeric format validation.");
      }
    }
      onProgress('Checking media/custom model formats and media references…');
      const mdb=await multiDB(),mt=mdb.transaction(['projects','examples','versions'],'readonly');
      const [mp,me,mv]=await Promise.all([mt.objectStore('projects').getAll(),mt.objectStore('examples').getAll(),mt.objectStore('versions').getAll()]);await mt.done;
      const pm=new Map(mp.map(p=>[p.id,p])),vm=new Map(mv.map(v=>[v.id,v]));
      for(const p of mp){await check();result.checked++;if(p.activeId&&vm.get(p.activeId)?.projectId!==p.id)issue('A media project has a missing/foreign active version.');}
      for(const e of me){await check();result.checked++;if(!pm.get(e.projectId)?.labels.includes(e.label))issue('A media example has a missing project/label.');if(await sha256(e.blob??e.text??'')!==e.hash)issue('A media example checksum mismatch was found.');}
      for(const v of mv){await check();result.checked++;if(!pm.has(v.projectId))issue('A media model has a missing project.');try{validateMultiModel(v.artifact);}catch{issue('A media model failed numeric validation.');}}
      try{result.checked+=(await listCustom()).length;}catch{issue('A custom model failed numeric validation.');}
      signal.throwIfAborted();
      result.complete = true;
    return result;
  });
}
// Intentionally no user-controlled names, IDs, URLs, hashes, labels, examples,
// artifacts, encryption/deletion secrets, user-agent strings or stack traces.
export function diagnosticSummary(
  inventory: Inventory,
  integrity: IntegrityResult | null,
) {
  return {
    format: "neuron-local-diagnostics",
    version: 1,
    applicationPhase: 5,
    inventory,
    integrity: integrity
      ? {
          complete: integrity.complete,
          checked: integrity.checked,
          issueCount: integrity.issues.length,
        }
      : null,
  };
}
export function StorageManager() {
  const [inventory, setInventory] = useState<Inventory | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<IntegrityResult | null>(null),
    [jobs, setJobs] = useState(activeJobs());
  const controller = useRef<AbortController | null>(null),
    lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void localInventory()
      .then((v) => {
        if (alive.current) setInventory(v);
      })
      .catch((e) => {
        if (alive.current) setError(explainError(e).message);
      });
    const unsubscribe = subscribeJobs(() => setJobs(activeJobs()));
    return () => {
      alive.current = false;
      controller.current?.abort();
      unsubscribe();
    };
  }, []);
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await localInventory();
      if (alive.current) {
        setInventory(next);
        setStatus("Local storage inventory refreshed.");
      }
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function scan() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    const c = new AbortController();
    controller.current = c;
    try {
      const next = await inspectLocalIntegrity(c.signal, (text) => {
        if (alive.current) setStatus(text);
      });
      if (alive.current) {
        setResult(next);
        setStatus(
          `Integrity scan complete: ${next.checked} records checked, ${next.issues.length}${next.issues.length === 100 ? "+" : ""} issues.`,
        );
      }
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    } finally {
      controller.current = null;
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="panel storage-manager">
      <h2>Browser storage & integrity</h2>
      <p>
        Inventory is local and read-only. It never uploads raw images, CSV data,
        model weights or deletion receipts. Estimates cover the entire origin,
        including caches, and are not exact database byte totals.
      </p>
      {inventory ? (
        <>
          <div className="storage-number">
            {bytes(inventory.originStorage.usage)}
            <small> used by this origin</small>
          </div>
          <p className="muted">
            Estimated quota: {bytes(inventory.originStorage.quota)} ·
            Persistence:{" "}
            {inventory.originStorage.persistent ? "Granted" : "Not guaranteed"}
          </p>
          <dl className="summary-list">
            <div>
              <dt>Image projects / samples / model versions</dt>
              <dd>
                {inventory.image.projects} / {inventory.image.samples} /{" "}
                {inventory.image.versions}
              </dd>
            </div>
            <div>
              <dt>Feedback queue / image blobs</dt>
              <dd>
                {inventory.image.feedback} / {bytes(inventory.image.blobBytes)}
              </dd>
            </div>
            <div>
              <dt>CSV projects / datasets / rows / versions</dt>
              <dd>
                {inventory.tabular.projects} / {inventory.tabular.datasets} /{" "}
                {inventory.tabular.rows} / {inventory.tabular.versions}
              </dd>
            </div>
            <div>
              <dt>Private deletion receipts</dt>
              <dd>{inventory.receipts}</dd>
            </div>
            <div><dt>Media projects / examples / versions / raw bytes</dt><dd>{inventory.media?.projects??0} / {inventory.media?.examples??0} / {inventory.media?.versions??0} / {bytes(inventory.media?.blobBytes??0)}</dd></div><div><dt>Custom numeric models</dt><dd>{inventory.customModels??0}</dd></div>
          </dl>
        </>
      ) : (
        <p role="status">Reading local inventory…</p>
      )}
      <div className="csv-upload-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh local inventory
        </Button>
        <Button
          variant="secondary"
          disabled={busy || jobs > 0}
          onClick={() => void scan()}
        >
          Scan local data integrity
        </Button>
        {busy && controller.current && (
          <Button variant="danger" onClick={() => controller.current?.abort()}>
            Cancel integrity scan
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={!inventory || busy}
          onClick={() => {
            if (inventory)
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      diagnosticSummary(inventory, result),
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                "neuron-local-diagnostics.json",
              );
          }}
        >
          Download metadata-only diagnostics
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !navigator.storage?.persist}
          onClick={() => {
            void navigator.storage
              .persist()
              .then((granted) => {
                setStatus(
                  granted
                    ? "Persistent storage granted. Still keep private backups."
                    : "The browser did not grant persistence. Export important projects.",
                );
                return refresh();
              })
              .catch((e) => setError(explainError(e).message));
          }}
        >
          Request persistent storage
        </Button>
      </div>
      {jobs > 0 && !busy && (
        <p className="phase-note">
          Finish/cancel this tab's active jobs before starting an integrity
          scan.
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {result && (
        <div className="storage-report">
          {result.issues.length
            ? result.issues.map((s, i) => `${i + 1}. ${s}`).join("\n")
            : "No reference, stored checksum or numeric model-format issues were found in the checked records."}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="phase-note">
        The scan uses snapshots, not a global multi-database lock: avoid edits
        in other tabs while scanning. Older images without stored hashes get
        reference checks only. This is not semantic dataset validation or proof
        that stored images decode. No automatic repair/deletion is performed.
        Back up first and investigate any issue. Diagnostics are not project
        backups.
      </p>
    </section>
  );
}
