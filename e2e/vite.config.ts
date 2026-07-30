import path from "node:path";

import { defineConfig } from "vite";

// Serves the e2e fixture against the live library source.
export default defineConfig({
  root: path.resolve(import.meta.dirname, "fixture"),
  resolve: {
    alias: [
      {
        find: "dom-cutout",
        replacement: path.resolve(import.meta.dirname, "../src/index.ts"),
      },
    ],
  },
});
