import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Ver el mismo comentario en apps/web-reception/vite.config.ts.
const apiHost = process.env["CC_API_TARGET"] ?? "localhost:4000";

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
      "/api": { target: `http://${apiHost}`, changeOrigin: true },
      "/ws-kiosk": { target: `ws://${apiHost}`, ws: true },
      "/product-images": { target: `http://${apiHost}`, changeOrigin: true },
      "/qr-images": { target: `http://${apiHost}`, changeOrigin: true },
      "/brand-images": { target: `http://${apiHost}`, changeOrigin: true },
    },
  },
}));
