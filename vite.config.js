import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": {
        changeOrigin: true,
        target: apiProxyTarget,
      },
      "/health": {
        changeOrigin: true,
        target: apiProxyTarget,
      },
    },
  },
  test: {
    css: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    setupFiles: "./src/test/setup.js",
  },
});
