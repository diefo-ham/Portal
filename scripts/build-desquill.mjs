// Rebuild the pinned, unmodified MPL-2.0 editor source for local redistribution.
import { build } from "esbuild";
import { compile } from "sass";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
await build({
  entryPoints: ["vendor/desquill/source/mq-public-api.ts"],
  outfile: "vendor/desquill/desquill.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
  plugins: [
    {
      name: "local-editor-assets",
      setup(build) {
        build.onLoad({ filter: /\.scss$/ }, (args) => ({
          contents: compile(args.path).css,
          loader: "css",
        }));
        build.onResolve({ filter: /^text!/ }, (args) => ({
          path: resolve(args.resolveDir, args.path.slice(5)),
          namespace: "raw-text",
        }));
        build.onLoad({ filter: /.*/, namespace: "raw-text" }, async (args) => ({
          contents: await readFile(args.path, "utf8"),
          loader: "text",
          resolveDir: dirname(args.path),
        }));
      },
    },
  ],
});
