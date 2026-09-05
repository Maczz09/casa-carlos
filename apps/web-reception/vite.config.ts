import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Por defecto el servidor de desarrollo corre en :4000. Se puede apuntar a
// otro puerto con CC_API_TARGET — sirve, por ejemplo, cuando el servicio de
// Windows ya instalado está ocupando el 4000 en la misma máquina.
const apiHost = process.env["CC_API_TARGET"] ?? "localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: `http://${apiHost}`, changeOrigin: true },
      "/ws": { target: `ws://${apiHost}`, ws: true },
      // Imágenes que sirve el propio servidor (fotos de producto, QR de las
      // billeteras, logo del hotel). Sin esto se ven rotas en desarrollo.
      "/product-images": { target: `http://${apiHost}`, changeOrigin: true },
      "/qr-images": { target: `http://${apiHost}`, changeOrigin: true },
      "/brand-images": { target: `http://${apiHost}`, changeOrigin: true },
    },
  },
});
