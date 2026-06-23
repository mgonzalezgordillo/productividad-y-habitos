import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", "out/**", ".next/**"]
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname
    }
  }
});
