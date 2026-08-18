/**
 * whatsapp-web.js trae puppeteer como dependencia, y por defecto su postinstall
 * descarga un Chromium propio (~200MB) — si la red del cliente lo bloquea o
 * corta, `pnpm install` termina con código de error y el instalador entero
 * falla, no solo la parte de WhatsApp. Windows ya trae Edge (Chromium) de
 * fábrica desde 2020 — services/notifications/src/senders/whatsapp-sender.ts
 * apunta puppeteer a esa instalación existente, así que no hace falta bajar
 * nada más. `skipDownload` evita el intento de descarga en cualquier máquina
 * donde se corra `pnpm install` (esta, la del cliente, o CI).
 */
module.exports = {
  skipDownload: true,
};
