import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Examples run against the live package source, not dist — edits to ../src
// hot-reload here, which is also how the README GIFs get recorded.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        react: path.resolve(import.meta.dirname, "react/index.html"),
        vanilla: path.resolve(import.meta.dirname, "vanilla/index.html"),
      },
    },
  },
  resolve: {
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
