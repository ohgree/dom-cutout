import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    // e2e/ holds playwright specs (pnpm test:e2e) — not vitest's to collect.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
