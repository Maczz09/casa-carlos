import { useEffect } from "react";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import type { User } from "@casacarlos/contracts";

const TOUR_KEY = "casacarlos.tour.v2";

const copy: Record<string, { title: string; text: string }> = {
  brand: { title: "Tu hotel, tu sistema", text: "El logo y el nombre se pueden cambiar desde Ajustes → Marca." },
  tablero: { title: "Tablero de cuartos", text: "Muestra disponibilidad, reservas, tiempos, tolerancias y limpieza en vivo." },
  venta: { title: "Nueva venta", text: "Guía el alquiler, productos, huésped y cobro, tanto para recepción como para el kiosco." },
  reservas: { title: "Reservas", text: "Abre el calendario diario, semanal o mensual y evita cruces de horario." },
  caja: { title: "Caja", text: "Controla turnos, IGV, ventas, entradas, salidas, arqueos y cierres." },
  bodega: { title: "Bodega", text: "Consulta productos, stock, precios y movimientos de inventario." },
  comprobantes: { title: "Comprobantes", text: "Revisa boletas, facturas, estados SUNAT, notas y documentos impresos." },
  dashboard: { title: "Dashboard", text: "Analiza ventas, ocupación, métodos de pago y horas pico con gráficos." },
  reportes: { title: "Reportes", text: "Trabaja con una hoja de cálculo interactiva y exporta CSV o PDF." },
  notificaciones: { title: "Notificaciones", text: "Configura destinatarios, plantillas y el canal de WhatsApp." },
  usuarios: { title: "Usuarios", text: "Crea cuentas y restringe módulos con permisos aplicados también en el servidor." },
  ajustes: { title: "Ajustes", text: "Administra marca, medios de pago, QR, bancos y los ambientes de SUNAT." },
  live: { title: "Actualización en vivo", text: "Cuando dice “En vivo”, los cambios de cuartos y del kiosco llegan sin recargar." },
  alerts: { title: "Avisos con sonido", text: "Activa las notificaciones de Windows para tiempos cumplidos y cambios importantes." },
  profile: { title: "Cuenta actual", text: "Aquí ves quién está operando y el rol con el que quedaron registrados los movimientos." },
};

export function startAppTour(user: User): void {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "cc-shepherd",
      cancelIcon: { enabled: true },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });
  const ids = ["brand", ...user.permisos.map((permission) => ({
    BOARD_VIEW: "tablero",
    SALES_MANAGE: "venta",
    RESERVATIONS_MANAGE: "reservas",
    CASHBOX_MANAGE: "caja",
    INVENTORY_MANAGE: "bodega",
    CATEGORIES_MANAGE: "categorias",
    ROOMS_MANAGE: "cuartos-admin",
    BILLING_MANAGE: "comprobantes",
    DASHBOARD_VIEW: "dashboard",
    REPORTS_EXPORT: "reportes",
    NOTIFICATIONS_MANAGE: "notificaciones",
    SETTINGS_MANAGE: "ajustes",
    USERS_MANAGE: "usuarios",
  })[permission]), "live", "alerts", "profile"];

  ids.filter((id, index) => ids.indexOf(id) === index).forEach((id) => {
    const element = document.querySelector(`[data-tour="${id}"]`);
    const content = copy[id];
    if (!element || !content) return;
    tour.addStep({
      id,
      title: content.title,
      text: content.text,
      attachTo: { element: `[data-tour="${id}"]`, on: id === "profile" ? "top" : "right" },
      buttons: [
        ...(id !== ids[0] ? [{ text: "Atrás", action: () => tour.back(), secondary: true }] : []),
        { text: "Siguiente", action: () => tour.next() },
      ],
    });
  });

  tour.on("complete", () => localStorage.setItem(TOUR_KEY, "done"));
  tour.on("cancel", () => localStorage.setItem(TOUR_KEY, "done"));
  tour.start();
}

export function useFirstRunTour(user: User): void {
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return;
    const timer = window.setTimeout(() => startAppTour(user), 900);
    return () => window.clearTimeout(timer);
  }, [user]);
}
