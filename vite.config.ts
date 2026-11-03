import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { serveLocalLibrary } from "./scripts/local-library.mjs";
import { serviceWorker } from "./scripts/service-worker.mjs";
export default defineConfig({
  // Relative URLs let the same build run at a domain root, a GitHub Pages
  // project path, or the local server. Set VITE_BASE to pin an absolute path.
  base: process.env.VITE_BASE ?? "./",
  plugins: [
    react(),
    serviceWorker(),
    {
      name: "dev-only-websocket-csp",
      apply: "serve",
      transformIndexHtml: (html) =>
        html.replace(
          "connect-src 'self' data:",
          "connect-src 'self' data: ws://127.0.0.1:4317",
        ),
    },
    {
      name: "private-local-library",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void serveLocalLibrary(req, res, next);
        });
      },
    },
  ],
});
