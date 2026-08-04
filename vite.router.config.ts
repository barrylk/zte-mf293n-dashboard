import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "router-ui",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist-router",
    emptyOutDir: true,
    target: "es2018",
    assetsInlineLimit: 4096,
  },
});
