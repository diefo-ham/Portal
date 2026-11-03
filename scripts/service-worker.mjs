import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const worker = `// Generated at build time. Precaches the built app so it opens offline.
const CACHE = "sat-study-__VERSION__";
// Large, rarely used files (the PDF reader) are kept after their first use.
const RUNTIME = CACHE + "-runtime";
const FILES = __FILES__;
const scope = new URL(self.registration.scope);
const at = (path) => new URL(path, scope);

self.addEventListener("install", (event) => {
  // No automatic skipWaiting: an open tab keeps its own version's files until the
  // person chooses to update (see src/updates.ts) or closes every tab.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(FILES.map((file) => new Request(at(file), { cache: "reload" }))),
      ),
  );
});

// The page asks for the update after the person agrees to reload.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("sat-study-") && key !== CACHE && key !== RUNTIME)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  // The private library always comes from the server.
  if (url.pathname.startsWith(at("local-library/").pathname)) return;
  event.respondWith(
    (async () => {
      const hit = await caches.match(request, { ignoreSearch: true });
      if (hit) return hit;
      if (request.mode === "navigate") {
        const shell = await caches.match(at("index.html"));
        if (shell) return shell;
      }
      const response = await fetch(request);
      if (response.ok && url.pathname.startsWith(at("assets/").pathname)) {
        const copy = response.clone();
        event.waitUntil(caches.open(RUNTIME).then((cache) => cache.put(request, copy)));
      }
      return response;
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
      // The PDF reader (its worker and the chunk that loads it) is cached on first use
      // instead of on every first visit.
      const lazy = /^assets\/(pdf\.worker\.min|run)-[^/]+\.m?js$/;
      const precache = ["./", ...files.filter((file) => !lazy.test(file))];
      await writeFile(
        join(outDir, "sw.js"),
        worker
          .replace("__VERSION__", hash.digest("hex").slice(0, 16))
          .replace("__FILES__", JSON.stringify(precache)),
      );
    },
  };
}
