import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve("private-data/library");
/** Only published local-library artifacts are exposed, never source PDFs or arbitrary files. */
export async function serveLocalLibrary(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  disabled = false,
) {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (!path.startsWith("/local-library/")) {
    next();
    return;
  }
  const relative = path.slice("/local-library/".length);
  if (
    disabled ||
    !(
      /^(manifest|questions|import-report)\.json$/.test(relative) ||
      /^assets\/[a-f0-9]{64}\.webp$/.test(relative)
    )
  ) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    const bytes = await readFile(resolve(root, relative));
    res.writeHead(200, {
      "Content-Type": relative.endsWith(".webp")
        ? "image/webp"
        : "application/json; charset=utf-8",
      "Cache-Control": relative.endsWith(".webp")
        ? "private, max-age=31536000, immutable"
        : "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}
