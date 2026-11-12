import "fake-indexeddb/auto";
import { afterEach, it, expect } from "vitest";
import { createProject } from "../features/projects/project.service";
import { changeClass } from "../features/datasets/dataset.store";
import {
  getProject,
  deleteProject,
  commitVersion,
  database,
  listVersions,
} from "../lib/db";
import type { ModelArtifact, ModelVersion } from "../lib/types";
const ids: string[] = [];
afterEach(async () => {
  for (const id of ids.splice(0)) await deleteProject(id);
});
function version(projectId: string): ModelVersion {
  return {
    id: crypto.randomUUID(),
    projectId,
    createdAt: Date.now(),
    artifact: {} as ModelArtifact,
  };
}
it("applies concurrent class edits against the latest project without lost additions", async () => {
  const p = await createProject("concurrent");
  ids.push(p.id);
  await Promise.all([
    changeClass(p.id, { kind: "add", name: "Third" }),
    changeClass(p.id, { kind: "add", name: "Fourth" }),
  ]);
  expect((await getProject(p.id))?.labels.map((l) => l.name)).toEqual([
    "Class 1",
    "Class 2",
    "Third",
    "Fourth",
  ]);
});
it("rejects duplicate names and renaming a deleted class", async () => {
  const p = await createProject("names");
  ids.push(p.id);
  await expect(
    changeClass(p.id, { kind: "add", name: " class 1 " }),
  ).rejects.toThrow(/already exists/);
  await expect(
    changeClass(p.id, { kind: "rename", id: "not-present", name: "Missing" }),
  ).rejects.toThrow(/deleted/);
  expect((await getProject(p.id))?.labels.length).toBe(2);
});
it("atomically rejects stale image-training commits after class edits", async () => {
  const p = await createProject("stale-class");
  ids.push(p.id);
  await changeClass(p.id, {
    kind: "rename",
    id: p.labels[0].id,
    name: "Changed",
  });
  await expect(
    commitVersion(version(p.id), { labels: p.labels, samples: [] }),
  ).rejects.toThrow(/changed during training/);
  expect(await listVersions(p.id)).toEqual([]);
  expect((await getProject(p.id))?.activeVersionId).toBeUndefined();
});
it("rejects stale training results after sample membership changes", async () => {
  const p = await createProject("stale-samples");
  ids.push(p.id);
  await (
    await database()
  ).add("samples", {
    id: crypto.randomUUID(),
    projectId: p.id,
    labelId: p.labels[0].id,
    blob: new Blob(["test"]),
    createdAt: 1,
  });
  await expect(
    commitVersion(version(p.id), { labels: p.labels, samples: [] }),
  ).rejects.toThrow(/changed during training/);
  expect(await listVersions(p.id)).toHaveLength(0);
});
