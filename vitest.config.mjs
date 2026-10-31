import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Two projects: the React app in jsdom, the server code (auth, database) in plain Node.
    projects: [
      { extends: true, test: { name: "web", include: ["src/**/*.test.{js,jsx}"], exclude: ["src/server/**"], environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.js"], css: false } },
      { extends: true, test: { name: "server", include: ["src/server/**/*.test.js", "scripts/**/*.test.mjs"], environment: "node", globals: true } },
    ],
  },
});
