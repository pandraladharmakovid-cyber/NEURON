import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const manager = process.env.npm_execpath;
if (!manager || !manager.toLowerCase().includes("pnpm"))
  throw new Error(
    "Run this gate with pnpm release:check, not node directly. It reuses the invoking pinned pnpm CLI across Windows/Linux.",
  );
async function pnpm(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [manager, ...args], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Release gate failed: pnpm " +
                args.join(" ") +
                " (exit " +
                code +
                ", signal " +
                signal +
                ")",
            ),
          ),
    );
  });
}
for (const script of [
  "check:env", "check:source",
  "check:boundaries",
  "typecheck",
  "test",
  "build",
])
  await pnpm(["run", script]);
await pnpm(["audit"]);
if (process.argv.includes("--browser")) await pnpm(["run", "test:e2e"]);
else
  console.log(
    "Browser gate NOT run. Use pnpm release:check --browser after installing Playwright Chromium.",
  );
console.log(
  "Requested local release gates passed. This command does not deploy or certify unsupported scaffold features.",
);
