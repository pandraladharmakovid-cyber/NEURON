import { test, expect } from "@playwright/test";
// Chromium's test device is a real MediaStream with deterministic synthetic frames.
// It exercises permission/media APIs, capture/normalization/persistence and cleanup;
// it is not certification of a physical camera or every browser's permission UI.
async function project(page: import("@playwright/test").Page) {
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Camera verification");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Camera verification" }),
  ).toBeVisible();
  await page.getByText("Capture examples for Class 1", { exact: true }).click();
}
test("explicit still capture is stored locally; navigation stops the active device", async ({
  page,
}) => {
  await project(page);
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") sent.push(r.url());
  });
  await page
    .getByRole("button", { name: "Use camera", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Preview ready. Capture only when you choose.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { testTrack: MediaStreamTrack }).testTrack = (
      document.querySelector("video")!.srcObject as MediaStream
    ).getVideoTracks()[0];
  });
  expect(await page.locator(".sample-thumb").count()).toBe(0);
  await page.getByRole("button", { name: "Save frame to Class 1" }).click();
  await expect(
    page.getByText("Added 1 images.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sample-thumb")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Settings & storage", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { testTrack: MediaStreamTrack }).testTrack
            .readyState,
      ),
    )
    .toBe("ended");
  expect(sent).toEqual([]);
});
test("camera preference changes in a second same-origin tab stop active streams", async ({
  page,
  context,
}) => {
  await project(page);
  await page
    .getByRole("button", { name: "Use camera", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Preview ready. Capture only when you choose.", {
      exact: true,
    }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/#/settings");
  await other
    .getByRole("checkbox", { name: /Allow camera controls in NEURON/ })
    .uncheck();
  await expect(
    page.getByRole("button", { name: "Use camera", exact: true }).first(),
  ).toBeDisabled();
  await expect(page.locator("video")).toHaveCount(0);
  await other.close();
});
test("denied device access gives actionable feedback and leaves file import usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied by test", "NotAllowedError");
    };
  });
  await project(page);
  await page
    .getByRole("button", { name: "Use camera", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera access was blocked",
  );
  await expect(
    page.locator(".class-panel").first().locator("input[type=file]"),
  ).toBeEnabled();
});

test("collapsing the dataset capture panel stops its camera rather than hiding a live device", async ({
  page,
}) => {
  await project(page);
  await page
    .getByRole("button", { name: "Use camera", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Preview ready. Capture only when you choose.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { testTrack: MediaStreamTrack }).testTrack = (
      document.querySelector("video")!.srcObject as MediaStream
    ).getVideoTracks()[0];
  });
  await page.getByText("Capture examples for Class 1", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { testTrack: MediaStreamTrack }).testTrack
            .readyState,
      ),
    )
    .toBe("ended");
  await expect(page.locator("video")).toHaveCount(0);
});
