import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { serveLocalLibrary } from "./local-library.mjs";
const port = Number(
  process.argv.includes("--port")
    ? process.argv[process.argv.indexOf("--port") + 1]
    : 4317,
);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local port.");
const root = resolve("dist");
try {
  await stat(resolve(root, "index.html"));
} catch {
  console.error("Build the app first: npm run build");
  process.exit(1);
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".mjs": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    if (
      new URL(req.url, "http://127.0.0.1").pathname.startsWith(
        "/local-library/",
      )
    ) {
      await serveLocalLibrary(
        req,
        res,
        () => {},
        process.argv.includes("--no-local-library"),
      );
      return;
    }
    const path = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    const target = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!target.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const bytes = await readFile(target);
    res.writeHead(200, {
      "Content-Type": mime[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Close the other SAT Study server, or open http://127.0.0.1:${port}.`
      : error,
  );
  process.exit(1);
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `SAT Study is ready at http://127.0.0.1:${port}\nKeep this terminal open. Internet is not required. Press Ctrl+C to stop.`,
  ),
);
