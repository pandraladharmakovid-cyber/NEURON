import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  createProject,
  replaceDataset,
  saveConfiguration,
  saveVersion,
  snapshot,
  deleteProject,
  activateVersion,
  importModel,
} from "../../tabular/repository";
import { fixture, config, options } from "./fixtures";
import { trainTabular } from "../../tabular/train";
it("persists datasets and versions, rolls back and atomically rejects stale result saves", async () => {
  const p = await createProject("  test  "),
    d = { ...(await fixture()), projectId: p.id };
  await replaceDataset(d);
  await saveConfiguration(p.id, d.hash, config);
  const a = await trainTabular({
      dataset: d,
      config,
      options: { ...options, epochs: 3 },
    }),
    v = await saveVersion(p.id, a),
    v2 = await saveVersion(p.id, a);
  expect((await snapshot(p.id)).project.activeVersionId).toBe(v2.id);
  await activateVersion(p.id, v.id);
  expect((await snapshot(p.id)).project.activeVersionId).toBe(v.id);
  await replaceDataset(d);
  await expect(saveVersion(p.id, a)).rejects.toThrow(/changed/);
  expect((await snapshot(p.id)).versions).toHaveLength(2);
  await deleteProject(p.id);
  await expect(snapshot(p.id)).rejects.toThrow(/not found/);
});
it("supports dataset-free model import and rejects foreign version activation", async () => {
  const a = await trainTabular({
      dataset: await fixture(),
      config,
      options: { ...options, epochs: 2 },
    }),
    p = await importModel(a),
    s = await snapshot(p.id),
    other = await createProject("other");
  expect(s.dataset).toBeNull();
  await expect(activateVersion(other.id, s.versions[0].id)).rejects.toThrow(
    /belong/,
  );
  await deleteProject(p.id);
  await deleteProject(other.id);
});
it("rejects tampered dataset and stale configuration", async () => {
  const p = await createProject("integrity"),
    d = { ...(await fixture()), projectId: p.id };
  d.rows[0][0] = "changed";
  await expect(replaceDataset(d)).rejects.toThrow(/checksum/);
  await expect(saveConfiguration(p.id, d.hash, config)).rejects.toThrow(
    /changed/,
  );
  await deleteProject(p.id);
});
