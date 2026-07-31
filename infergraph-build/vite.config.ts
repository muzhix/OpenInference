import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/build/api": "http://127.0.0.1:9001",
      "/workflows": "http://127.0.0.1:9001",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
