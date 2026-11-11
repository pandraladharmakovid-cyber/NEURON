import "fake-indexeddb/auto";
import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { openDB, deleteDB } from "idb";
import {
  activateVersion,
  database,
  closeDatabase,
  getProject,
  deleteProject,
  snapshotProject,
} from "../lib/db";
import {
  queueFeedback,
  approveFeedback,
  discardFeedback,
  listFeedback,
  comparable,
} from "../features/evolution/evolution.service";
import type { ModelVersion, Project } from "../lib/types";
const project: Project = {
  id: "p",
  name: "Test",
  labels: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ],
  createdAt: 1,
  updatedAt: 1,
};
const artifact = {
  format: "neuron-image",
  version: 1,
  labels: project.labels,
} as unknown as ModelVersion["artifact"];
const version: ModelVersion = {
  id: "v",
  projectId: "p",
  createdAt: 1,
  artifact,
};
beforeEach(async () => {
  await closeDatabase();
  await deleteDB("neuron-local");
});
afterAll(closeDatabase);
async function setup() {
  const db = await database();
  await db.put("projects", project);
  await db.put("versions", version);
  return db;
}
describe("storage migration and consent workflow", () => {
  it("activation preserves the latest class vocabulary", async () => {
    const db = await setup();
    await db.put("projects", {
      ...project,
      labels: [
        { id: "a", name: "Updated A" },
        { id: "b", name: "B" },
      ],
    });
    await activateVersion("p", "v");
    expect((await getProject("p"))?.labels[0].name).toBe("Updated A");
    expect((await getProject("p"))?.activeVersionId).toBe("v");
  });
  it("rejects activating a version from another project", async () => {
    const db = await setup();
    await db.put("versions", {
      ...version,
      id: "foreign",
      projectId: "different",
    });
    await expect(activateVersion("p", "foreign")).rejects.toThrow("not found");
    expect((await getProject("p"))?.activeVersionId).toBeUndefined();
  });
  it("preserves original v1 records during additive upgrade", async () => {
    const old = await openDB("neuron-local", 1, {
      upgrade(db) {
        db.createObjectStore("projects", { keyPath: "id" });
        db.createObjectStore("samples", { keyPath: "id" }).createIndex(
          "by-project",
          "projectId",
        );
        db.createObjectStore("versions", { keyPath: "id" }).createIndex(
          "by-project",
          "projectId",
        );
      },
    });
    await old.put("projects", project);
    await old.put("versions", version);
    await old.put("samples", {
      id: "legacy",
      projectId: "p",
      labelId: "a",
      createdAt: 1,
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
    });
    old.close();
    expect(await getProject("p")).toEqual(project);
    const snapshot = await snapshotProject("p");
    expect(snapshot.samples).toHaveLength(1);
    expect(snapshot.versions).toHaveLength(1);
    expect((await database()).objectStoreNames.contains("feedback")).toBe(true);
  });
  it("does not approve a queued image until explicit review", async () => {
    await setup();
    const f = await queueFeedback(
      "p",
      "v",
      "a",
      new Blob(["jpeg"], { type: "image/jpeg" }),
      "B",
    );
    expect((await snapshotProject("p")).samples).toHaveLength(0);
    await approveFeedback(f.id);
    expect((await snapshotProject("p")).samples).toHaveLength(1);
    expect(await listFeedback("p")).toHaveLength(0);
  });
  it("rejects duplicate feedback without consuming the pending item", async () => {
    await setup();
    const blob = new Blob(["same"], { type: "image/jpeg" });
    const a = await queueFeedback("p", "v", "a", blob, "A");
    await approveFeedback(a.id);
    const b = await queueFeedback("p", "v", "b", blob, "A");
    await expect(approveFeedback(b.id)).rejects.toThrow("already exists");
    expect(await listFeedback("p")).toHaveLength(1);
  });
  it("discard does not modify training samples", async () => {
    await setup();
    const f = await queueFeedback(
      "p",
      "v",
      "a",
      new Blob(["jpeg"], { type: "image/jpeg" }),
      "A",
    );
    await discardFeedback(f.id);
    expect((await snapshotProject("p")).samples).toHaveLength(0);
    expect(await listFeedback("p")).toHaveLength(0);
  });
  it("deleting a project deletes related feedback too", async () => {
    await setup();
    await queueFeedback(
      "p",
      "v",
      "a",
      new Blob(["jpeg"], { type: "image/jpeg" }),
      "A",
    );
    await deleteProject("p");
    expect(await listFeedback("p")).toHaveLength(0);
    expect(await getProject("p")).toBeUndefined();
  });
  it("rejects removed classes", async () => {
    await setup();
    await expect(
      queueFeedback(
        "p",
        "v",
        "missing",
        new Blob(["jpeg"], { type: "image/jpeg" }),
        "A",
      ),
    ).rejects.toThrow();
  });
  it("warns on incomparable legacy models", () =>
    expect(comparable(version, version)).toBe(false));
  it("compares only identical validation fingerprints", () => {
    const a = {
      ...version,
      artifact: {
        ...artifact,
        provenance: {
          datasetHash: "1".repeat(64),
          validationHash: "2".repeat(64),
          seed: 42,
          sampleCount: 10,
        },
      },
    };
    expect(comparable(a, a)).toBe(true);
    expect(
      comparable(a, {
        ...a,
        artifact: {
          ...a.artifact,
          provenance: {
            ...a.artifact.provenance,
            validationHash: "3".repeat(64),
          },
        },
      }),
    ).toBe(false);
  });
});