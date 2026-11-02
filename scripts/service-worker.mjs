import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const worker = `// Generated at build time. Precaches the built app so it opens offline.
const CACHE = "sat-study-__VERSION__";
const FILES = __FILES__;
const scope = new URL(self.registration.scope);
const at = (path) => new URL(path, scope);

self.addEventListener("install", (event) => {
  // No skipWaiting: an open tab keeps its own version's files until it closes.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(FILES.map((file) => new Request(at(file), { cache: "reload" }))),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("sat-study-") && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  // Private library and runtime calculator configuration always come from the server.
  if (
    url.pathname.startsWith(at("local-library/").pathname) ||
    url.pathname === at("calculator-config.json").pathname
  )
    return;
  event.respondWith(
    (async () => {
      const hit = await caches.match(request, { ignoreSearch: true });
      if (hit) return hit;
      if (request.mode === "navigate") {
        const shell = await caches.match(at("index.html"));
        if (shell) return shell;
      }
      return fetch(request);
    })(),
  );
});
`;

async function list(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await list(path)));
    else files.push(path);
  }
  return files;
}

/** Emits dist/sw.js listing every built file, versioned by their combined hash. */
export function serviceWorker() {
  let outDir = "dist";
  return {
    name: "offline-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const files = (await list(outDir))
        .map((path) => relative(outDir, path).split(sep).join("/"))
        .filter(
          (path) =>
            path !== "sw.js" &&
            !path.startsWith("licenses/") &&
            !path.endsWith(".map"),
        )
        .sort();
      const hash = createHash("sha256");
      for (const file of files) {
        hash.update(file);
        hash.update(await readFile(join(outDir, file)));
      }
      const precache = [
        "./",
        ...files.filter((file) => file !== "calculator-config.json"),
      ];
      await writeFile(
        join(outDir, "sw.js"),
        worker
          .replace("__VERSION__", hash.digest("hex").slice(0, 16))
          .replace("__FILES__", JSON.stringify(precache)),
      );
    },
  };
}
