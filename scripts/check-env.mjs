import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12))
  throw new Error(
    "NEURON requires Node >=22.12. Install a supported Node release; do not bypass the engine check.",
  );
const manifest = JSON.parse(await readFile(root + "package.json", "utf8"));
if (manifest.packageManager !== "pnpm@9.15.5")
  throw new Error(
    "Expected the tested pnpm@9.15.5 package-manager declaration.",
  );
if (process.env.NEURON_RELAY_TARGET) {
  const url = new URL(process.env.NEURON_RELAY_TARGET);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "NEURON_RELAY_TARGET must be an HTTP(S) service URL without credentials.",
    );
}
if (process.env.NEURON_RELAY_PORT) {
  const port = Number(process.env.NEURON_RELAY_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(
      "NEURON_RELAY_PORT must be an integer between 1024 and 65535.",
    );
}
console.log(
  "Environment check PASS: supported Node, pinned package manager and valid optional local relay settings. No API key is required for local training.",
);
