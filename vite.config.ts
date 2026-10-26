import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { serveLocalLibrary } from "./scripts/local-library.mjs";
export default defineConfig({
  plugins: [
    react(),
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
