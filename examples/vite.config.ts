import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Examples run against the live package source, not dist — edits to ../src
// hot-reload here, which is also how the README GIFs get recorded.
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        react: path.resolve(import.meta.dirname, "react/index.html"),
        // demo/ is the gif-capture scene for scripts/record-demo.ts —
        // served by `pnpm dev` but deliberately not built/deployed.
      },
    },
  },
  resolve: {
    // The dom-cutout aliases point outside this app's root, so the adapter's
    // bare `react` import would resolve to the package's node_modules — a
    // second React copy that null-dispatchers every hook in production
    // builds (dev masks it by prebundling all `react` imports to one copy).
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: "dom-cutout/react",
        replacement: path.resolve(import.meta.dirname, "../src/react.tsx"),
      },
      {
        find: "dom-cutout",
        replacement: path.resolve(import.meta.dirname, "../src/index.ts"),
      },
    ],
  },
});
