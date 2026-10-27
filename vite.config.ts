import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { serveLocalLibrary } from "./scripts/local-library.mjs";
import { serveCalculatorConfig } from "./scripts/calculator-config.mjs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "private-local-library",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void serveCalculatorConfig(req, res).then((handled) => {
            if (!handled) void serveLocalLibrary(req, res, next);
          });
        });
      },
    },
  ],
});
