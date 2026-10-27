import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

// Local browser-side API configuration; never embedded in committed source/builds.
export async function serveCalculatorConfig(req, res, disabled = false) {
  if (
    new URL(req.url, "http://127.0.0.1").pathname !== "/calculator-config.json"
  )
    return false;
  let key = "";
  if (!disabled) {
    try {
      key =
        process.env.DESMOS_API_KEY ||
        parseEnv(await readFile(".env.local", "utf8")).DESMOS_API_KEY ||
        "";
    } catch {
      /* Missing local configuration is normal. */
    }
  }
  // Preserve the static runtime-config option when no local environment is set.
  if (!disabled && !key.trim()) return false;
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify({ desmosApiKey: key.trim().slice(0, 499) }));
  return true;
}
