// Refresh offline redistribution notices from locked production packages.
import {
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  await readFile(join(root, "package-lock.json"), "utf8"),
);
const output = join(root, "public", "licenses");
await mkdir(output, { recursive: true });
const index = [
  "Third-party software notices",
  "",
  "These libraries are installed/bundled locally. No remote calculator service is used.",
  "",
];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith("node_modules/") || entry.dev) continue;
  const folder = join(root, path);
  const pkg = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
  const label = pkg.name.replaceAll("/", "-").replaceAll("@", "");
  index.push(
    `${pkg.name} ${pkg.version} — ${pkg.license || "see package license"}`,
  );
  let found = false;
  for (const filename of await readdir(folder)) {
    if (!/^(license|licence|notice)(\.|$)/i.test(filename)) continue;
    const target = `${label}-${filename}.txt`;
    await copyFile(join(folder, filename), join(output, target));
    index.push(`  ${target}`);
    found = true;
  }
  if (!found && pkg.main) {
    const source = await readFile(
      join(folder, pkg.name === "seedrandom" ? "seedrandom.js" : pkg.main),
      "utf8",
    );
    const notice = source.match(/^\s*\/\*[\s\S]*?\*\//)?.[0];
    if (notice && /license|permission|copyright/i.test(notice)) {
      const target = `${label}-source-notice.txt`;
      await writeFile(join(output, target), notice + "\n");
      index.push(`  ${target}`);
    }
  }
}
// The KaTeX font source carries its own MIT copyright notice.
const katexLicense = await readFile(
  join(root, "node_modules/katex/LICENSE"),
  "utf8",
);
await writeFile(
  join(output, "katex-fonts-LICENSE.txt"),
  katexLicense.replace(
    "Copyright (c) 2013-2020 Khan Academy and other contributors",
    "Copyright (c) 2018 Khan Academy",
  ),
);
index.push(
  "",
  "KaTeX font source: https://github.com/KaTeX/katex-fonts/blob/master/LICENSE",
  "  katex-fonts-LICENSE.txt",
  "",
);
await writeFile(join(output, "index.txt"), index.join("\n"));
console.log("Updated local production dependency notices.");
