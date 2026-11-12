import { defineConfig, devices } from "@playwright/test";
const external = process.env.NEURON_E2E_BASE_URL;
const baseURL = external ?? "http://localhost:4173";
const url = new URL(baseURL);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
  throw new Error("Invalid E2E base URL.");
export default defineConfig({
  testDir: "../../tests/e2e",
  // Explicit reviewed production regression suite.
  testMatch: [
    "accessibility.spec.ts",
    "permissions.spec.ts",
    "storage.spec.ts", "phase6.spec.ts", "security.spec.ts",
  ],
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: "pnpm preview --port 4173 --strictPort",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
