import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
function offlineShell(): Plugin {
  return {
    name: "neuron-offline-shell",
    apply: "build",
    enforce: "post",
    async generateBundle(_, bundle) {
      const paths = [
        "/offline.html",
        "/favicon.svg",
        "/manifest.webmanifest",
        ...Object.keys(bundle)
          .filter((p) => !p.endsWith(".map"))
          .map((p) => "/" + p),
      ].sort();
      const workerTemplate = readFileSync(
        new URL("./src/pwa/service-worker.ts", import.meta.url),
        "utf8",
      );
      const publicRevision = [
        "offline.html",
        "favicon.svg",
        "manifest.webmanifest",
      ]
        .map((name) =>
          readFileSync(new URL("./public/" + name, import.meta.url), "utf8"),
        )
        .join("\n");
      const revision = createHash("sha256")
        .update(workerTemplate)
        .update(publicRevision)
        .update(paths.join("\n"))
        .update(
          String(
            bundle["index.html"]?.type === "asset"
              ? bundle["index.html"].source
              : "",
          ),
        )
        .digest("hex")
        .slice(0, 16);
      const source = readFileSync(
        new URL("./src/pwa/service-worker.ts", import.meta.url),
        "utf8",
      )
        .replace("__NEURON_PRECACHE__", JSON.stringify(paths))
        .replace("__NEURON_REVISION__", revision);
      const compiled = await transformWithEsbuild(source, "service-worker.ts", {
        loader: "ts",
        target: "es2022",
        minify: true,
      });
      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: compiled.code,
      });
    },
  };
}
function securityHeaders():Plugin{return {name:'neuron-preview-security-headers',configurePreviewServer(server){const text=readFileSync(new URL('./public/_headers',import.meta.url),'utf8');const headers=text.split('\n').filter(line=>line.startsWith('  ')).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];});server.middlewares.use((_req,res,next)=>{for(const [key,value] of headers)res.setHeader(key,value);next();});}};}
const relayTarget = process.env.NEURON_RELAY_TARGET || "http://127.0.0.1:8787";
const relayURL = new URL(relayTarget);
if (
  !["http:", "https:"].includes(relayURL.protocol) ||
  relayURL.username ||
  relayURL.password
)
  throw new Error("Invalid NEURON_RELAY_TARGET");
const proxy = { "/api/shares": { target: relayTarget, changeOrigin: false } };
export default defineConfig({
  plugins: [react(), offlineShell(),securityHeaders()],
  server: { host: "0.0.0.0", allowedHosts: [".e2b.app", "localhost"], proxy },
  preview: { host: "0.0.0.0", allowedHosts: [".e2b.app", "localhost"], proxy },
  worker: { format: "es" },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@tensorflow")) return "tensorflow";
        },
      },
    },
  },
});
