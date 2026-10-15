import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./lib/__tests__/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
