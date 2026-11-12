import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function imageProject(page: import("@playwright/test").Page) {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Private source project");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Private source project" }),
  ).toBeVisible();
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8a4ee9";
    ctx.fillRect(0, 0, 900, 1200);
    ctx.fillStyle = "#4bcbe8";
    ctx.fillRect(100, 100, 300, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator(".class-panel input[type=file]")
    .first()
    .setInputFiles({
      name: "private-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(base64, "base64"),
    });
  await expect(
    page.getByText("Added 1 images.", { exact: true }),
  ).toBeVisible();
  return page.url();
}
test("real normalization worker bounds images; metadata export excludes names/pixels/secrets", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await imageProject(page);
  expect(requests.some((u) => /dataset\.worker-.*\.js/.test(u))).toBe(true);
  const dimensions = await page.evaluate(async () => {
    const r = indexedDB.open("neuron-local", 2);
    const db = await new Promise<IDBDatabase>((resolve) => {
      r.onsuccess = () => resolve(r.result);
    });
    const sample = await new Promise<{ blob: Blob }>((resolve) => {
      const q = db.transaction("samples").objectStore("samples").getAll();
      q.onsuccess = () => resolve(q.result[0]);
    });
    db.close();
    const bitmap = await createImageBitmap(sample.blob);
    const size = [bitmap.width, bitmap.height];
    bitmap.close();
    return size;
  });
  expect(Math.max(...dimensions)).toBe(768);
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Scan local data integrity" }).click();
  await expect(page.getByText(/Integrity scan complete:/)).toBeVisible();
  await expect(
    page.getByText(
      "No reference, stored checksum or numeric model-format issues were found in the checked records.",
      { exact: true },
    ),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download metadata-only diagnostics" })
    .click();
  const file = await downloaded,
    contents = await readFile((await file.path())!, "utf8"),
    report = JSON.parse(contents);
  expect(report.format).toBe("neuron-local-diagnostics");
  expect(report.inventory.image.samples).toBe(1);
  for (const value of [
    "Private source project",
    "private-photo",
    "deleteToken",
    "weightData",
    "labelId",
    "data:image",
  ])
    expect(contents).not.toContain(value);
});
test("read-only integrity scan detects corrupt image checksum and does not delete data", async ({
  page,
}) => {
  await imageProject(page);
  await page.evaluate(async () => {
    const r = indexedDB.open("neuron-local", 2),
      db = await new Promise<IDBDatabase>((resolve) => {
        r.onsuccess = () => resolve(r.result);
      });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("samples", "readwrite"),
        q = tx.objectStore("samples").getAll();
      q.onsuccess = () =>
        tx.objectStore("samples").put({ ...q.result[0], hash: "0".repeat(64) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Scan local data integrity" }).click();
  await expect(page.getByText(/Integrity scan complete:/)).toBeVisible();
  await expect(page.locator(".storage-report")).toContainText(
    "checksum does not match",
  );
  await page.getByRole("link", { name: "My projects", exact: true }).click();
  await page.getByRole("link", { name: /Private source project/ }).click();
  await expect(page.locator(".sample-thumb")).toHaveCount(1);
});
test("safe image-model import creates a new project without deleting source samples", async ({
  page,
}) => {
  await imageProject(page);
  const weightData = Buffer.alloc((1280 * 2 + 2) * 4).toString("base64");
  const model = {
    format: "neuron-image",
    version: 1,
    encoder: "mobilenet-v2-1.0",
    embeddingSize: 1280,
    labels: [
      { id: "a", name: "One" },
      { id: "b", name: "Two" },
    ],
    weightSpecs: [
      { name: "head_0", shape: [1280, 2], dtype: "float32" },
      { name: "head_1", shape: [2], dtype: "float32" },
    ],
    weightData,
    epochs: [
      { epoch: 1, loss: 0.69, accuracy: 0.5, valLoss: 0.69, valAccuracy: 0.5 },
    ],
    evaluation: {
      accuracy: 0.5,
      total: 2,
      matrix: [
        [1, 0],
        [1, 0],
      ],
    },
    createdAt: Date.now(),
  };
  await page.goto("/#/settings");
  await page
    .getByRole("button", {
      name: "Import image model as new project",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input[type=file]").setInputFiles({
    name: "fixture.neuron.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(model)),
  });
  await expect(
    page.getByRole("heading", { name: "Validated image model" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: /Import these weights and labels into a NEW local project/,
    })
    .check();
  await page
    .getByRole("button", { name: "Import image model as new", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meet your model." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My projects", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.getByRole("link", { name: /Private source project/ }).click();
  await expect(page.locator(".sample-thumb")).toHaveCount(1);
});

test("sample pagination exposes records beyond the old 120-thumbnail limit", async ({
  page,
}) => {
  const route = await imageProject(page);
  // Seed a view-only pagination fixture, not a training-quality/duplicate test.
  // Normal ingestion's real duplicate guard is covered by the regression run.
  await page.evaluate(async () => {
    const request = indexedDB.open("neuron-local", 2);
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("samples", "readwrite"),
        store = tx.objectStore("samples"),
        read = store.getAll();
      read.onsuccess = () => {
        const original = read.result[0];
        for (let i = 1; i < 130; i++)
          store.add({
            ...original,
            id: crypto.randomUUID(),
            createdAt: Date.now() + i,
          });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator(".sample-thumb")).toHaveCount(48);
  await page.getByRole("button", { name: "Next samples", exact: true }).click();
  await expect(
    page.getByText("Page 2/3 · 130 samples", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next samples", exact: true }).click();
  await expect(page.locator(".sample-thumb")).toHaveCount(34);
  await expect(
    page.getByText("Page 3/3 · 130 samples", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove sample", exact: true })
    .first()
    .click();
  await expect(page.locator(".sample-thumb")).toHaveCount(33);
  await expect(
    page.getByText("Page 3/3 · 129 samples", { exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(route);
});

test("class rename rejects duplicates without losing the edit, then saves a valid name", async ({
  page,
}) => {
  await imageProject(page);
  await page.getByRole("button", { name: "Class 1 edit", exact: true }).click();
  const field = page.getByRole("textbox", {
    name: "New name for Class 1",
    exact: true,
  });
  await field.fill("Class 2");
  await page
    .getByRole("button", { name: "Save class name", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Class name already exists",
  );
  await expect(field).toBeVisible();
  await field.fill("Plants");
  await page
    .getByRole("button", { name: "Save class name", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Plants edit", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sample-thumb")).toHaveCount(1);
});
