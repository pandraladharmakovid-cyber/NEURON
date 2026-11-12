import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  web = resolve(root, "apps/web"),
  visited = new Set(),
  queue = [resolve(web, "src/main.tsx")],
  failures = [];
async function locate(path) {
  for (const suffix of [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".css",
    ".json",
    "/index.ts",
    "/index.tsx",
  ]) {
    try {
      const candidate = path + suffix;
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  return null;
}
while (queue.length) {
  const file = queue.pop();
  if (visited.has(file)) continue;
  visited.add(file);
  const text = await readFile(file, "utf8");
  if (/PLANNED MODULE|Not implemented\. See the architecture/.test(text))
    failures.push("Reachable scaffold placeholder: " + relative(root, file));
  if (![".ts", ".tsx", ".js", ".mjs"].includes(extname(file))) continue;
  const imports = [
    ...text.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"\n]+)\1/g,
    ),
  ].map((m) => m[2]);
  // Vite statically bundles these module worker URLs as a separate graph.
  for (const match of text.matchAll(
    /new URL\(\s*(['"])([^'"\n]+)\1\s*,\s*import\.meta\.url\s*\)/g,
  ))
    imports.push(match[2]);
  for (const specifier of imports) {
    if (!specifier.startsWith(".")) {
      if (/^node:|^miniflare$|^wrangler$/.test(specifier))
        failures.push(
          "Server dependency in browser graph: " + relative(root, file),
        );
      continue;
    }
    const path = resolve(dirname(file), specifier);
    if (!path.startsWith(web + "/") && !path.startsWith(web + "\\")) {
      failures.push(
        "Browser source escapes app boundary: " + relative(root, file),
      );
      continue;
    }
    const found = await locate(path);
    if (!found)
      failures.push(
        "Missing relative module: " + relative(root, file) + " -> " + specifier,
      );
    else queue.push(found);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Browser import-boundary check PASS: ${visited.size} reachable source/asset files; no reachable planned stubs or server dependencies. This static scan is not a complete security audit.`,
  );
