import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
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
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
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
      ? "Port 4317 is in use. Close the other SAT Study server, or open http://127.0.0.1:4317."
      : error,
  );
  process.exit(1);
});
server.listen(4317, "127.0.0.1", () =>
  console.log(
    "SAT Study is ready at http://127.0.0.1:4317\nKeep this terminal open. Internet is not required. Press Ctrl+C to stop.",
  ),
);
