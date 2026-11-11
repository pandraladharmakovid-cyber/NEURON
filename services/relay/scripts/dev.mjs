import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  entryPoints: [root + "src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const script = result.outputFiles[0].text;
if (process.argv.includes("--build")) {
  await mkdir(root + "build", { recursive: true });
  await writeFile(root + "build/worker.mjs", script);
  console.log("Relay Worker bundle built. Cloud deployment is NOT performed.");
} else {
  const port = Number(process.env.NEURON_RELAY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid NEURON_RELAY_PORT");
  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: "2026-07-01",
    host: "0.0.0.0",
    port,
    r2Buckets: ["SHARES"],
    r2Persist: root + ".local/relay-r2",
    durableObjects: { LIMITER: { className: "RateLimiter", useSQLite: true } },
    durableObjectsPersist: root + ".local/relay-do",
    bindings: {
      ENVIRONMENT: "development",
      ENABLE_UPLOADS: "true",
      ALLOWED_ORIGINS:
        "http://localhost:5173,http://localhost:4173,http://localhost:4174",
      RATE_SALT: "local-development-only-not-a-production-secret",
    },
  });
  const url = await mf.ready;
  console.log(
    "NEURON encrypted relay ready at " +
      url +
      " — DEVELOPMENT ONLY. Restart after changing relay source.",
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => void mf.dispose().then(() => process.exit(0)));
}