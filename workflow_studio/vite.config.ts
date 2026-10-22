/// <reference types="vitest/config" />
import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Node-free process.env access (no @types/node dependency). */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const backendTarget = env.WORKFLOW_STUDIO_BACKEND ?? "http://localhost:9001";

export default defineConfig({
  base: "/studio/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backendTarget, changeOrigin: false },
      "/workflows": { target: backendTarget, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
