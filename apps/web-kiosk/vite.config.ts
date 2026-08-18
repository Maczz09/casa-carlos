import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  // Solo en build: apps/server sirve este dist/ bajo /kiosk/ (ver
  // apps/server/src/index.ts), así que sus assets tienen que resolver ahí.
  // En dev (`command === "serve"`) el propio puerto :5174 sigue siendo la
  // raíz — cambiar `base` también en dev rompería el flujo de desarrollo
  // actual (`http://localhost:5174/`, no `/kiosk/`).
  base: command === "build" ? "/kiosk/" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/ws-kiosk": { target: "ws://localhost:4000", ws: true },
    },
  },
}));
