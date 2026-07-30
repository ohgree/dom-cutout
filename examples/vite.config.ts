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
        index: path.resolve(__dirname, "index.html"),
        react: path.resolve(__dirname, "react/index.html"),
        vanilla: path.resolve(__dirname, "vanilla/index.html"),
      },
    },
  },
  resolve: {
    alias: [
      {
        find: "dom-cutout/react",
        replacement: path.resolve(__dirname, "../src/react.tsx"),
      },
      {
        find: "dom-cutout",
        replacement: path.resolve(__dirname, "../src/index.ts"),
      },
    ],
  },
});
