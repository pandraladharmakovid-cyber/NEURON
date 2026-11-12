import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  encodeBackup,
  decodeBackup,
  restoreBackup,
} from "../../tabular/backup";
import {
  createProject,
  replaceDataset,
  saveConfiguration,
  saveVersion,
  snapshot,
  deleteProject,
  projects,
} from "../../tabular/repository";
import { fixture, config, options } from "./fixtures";
import { trainTabular } from "../../tabular/train";
it("roundtrips raw data and models, restores new IDs without overwriting originals", async () => {
  const p = await createProject("backup"),
    d = { ...(await fixture()), projectId: p.id };
  await replaceDataset(d);
  await saveConfiguration(p.id, d.hash, config);
  await saveVersion(
    p.id,
    await trainTabular({
      dataset: d,
      config,
      options: { ...options, epochs: 2 },
    }),
  );
  const s = await snapshot(p.id),
    blob = await encodeBackup(s),
    decoded = await decodeBackup(blob);
  expect(decoded.dataset?.rows).toEqual(d.rows);
  const restored = await restoreBackup(blob),
    r = await snapshot(restored.id);
  expect(restored.id).not.toBe(p.id);
  expect(r.versions[0].id).not.toBe(s.versions[0].id);
  expect(r.project.activeVersionId).toBe(r.versions[0].id);
  expect(r.dataset?.projectId).toBe(restored.id);
  expect((await snapshot(p.id)).dataset?.rows).toEqual(d.rows);
  await deleteProject(p.id);
  await deleteProject(restored.id);
});
it("rejects corrupt backups before inserting any project", async () => {
  const p = await createProject("corrupt"),
    d = { ...(await fixture()), projectId: p.id };
  await replaceDataset(d);
  const s = await snapshot(p.id);
  s.dataset!.rows[0][0] = "evil";
  const before = (await projects()).length;
  await expect(restoreBackup(await encodeBackup(s))).rejects.toThrow(
    /checksum/,
  );
  expect((await projects()).length).toBe(before);
  await expect(decodeBackup(new Blob(["{}"]))).rejects.toThrow(
    /different format/,
  );
  await deleteProject(p.id);
});
