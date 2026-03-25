import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, "src/main/index.ts")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, "src/main/preload.ts")
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    server: {
      host: "127.0.0.1",
      port: 5174
    },
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
        "@shared": resolve(__dirname, "src/shared")
      }
    }
  }
});
