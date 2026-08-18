import type { RoomStatus } from "@casacarlos/contracts";
import { IconAlertTriangle, IconBan, IconBed, IconBookmark, IconBroom, IconCheck, IconClock } from "./icons.js";

export interface StatusStyle {
  label: string;
  icon: typeof IconCheck;
  /** Barra superior de la tarjeta + color del icono. */
  accent: string;
  /**
   * Clase de tinte para la píldora de estado (`.tone-*`, definida en el CSS de
   * cada app). Se nombra el tono en vez de fijar colores acá para que el mismo
   * estado se vea bien en claro y en oscuro sin que este paquete sepa de temas.
   */
  tone: string;
  /** Piso de la ilustración. Es un `var()` con fallback: las apps que no definen tokens de tema (el kiosco) siguen viéndose igual que siempre. */
  floorFill: string;
  pulse: boolean;
  muted: boolean;
}

export const STATUS_STYLE: Record<RoomStatus, StatusStyle> = {
  DISPONIBLE: {
    label: "Disponible",
    icon: IconCheck,
    accent: "#0D9488",
    tone: "tone-teal",
    floorFill: "var(--room-floor-teal, #F5F1E8)",
    pulse: false,
    muted: false,
  },
  RESERVADO: {
    label: "Reservado",
    icon: IconBookmark,
    accent: "#7C3AED",
    tone: "tone-violet",
    floorFill: "var(--room-floor-violet, #F1EDFB)",
    pulse: false,
    muted: false,
  },
  OCUPADO: {
    label: "Ocupado",
    icon: IconBed,
    accent: "#E11D48",
    tone: "tone-rose",
    floorFill: "var(--room-floor-rose, #FCEEF0)",
    pulse: false,
    muted: false,
  },
  EN_TOLERANCIA: {
    label: "En tolerancia",
    icon: IconClock,
    accent: "#D97706",
    tone: "tone-amber",
    floorFill: "var(--room-floor-amber, #FDF3E1)",
    pulse: false,
    muted: false,
  },
  EXCEDIDO: {
    label: "Excedido",
    icon: IconAlertTriangle,
    accent: "#B91C1C",
    tone: "tone-red",
    floorFill: "var(--room-floor-red, #FBE6E6)",
    pulse: true,
    muted: false,
  },
  LIMPIEZA: {
    label: "En limpieza",
    icon: IconBroom,
    accent: "#0284C7",
    tone: "tone-sky",
    floorFill: "var(--room-floor-sky, #EFF0EE)",
    pulse: false,
    muted: true,
  },
  FUERA_DE_SERVICIO: {
    label: "Fuera de servicio",
    icon: IconBan,
    accent: "#78716C",
    tone: "tone-stone",
    floorFill: "var(--room-floor-stone, #EBE8E4)",
    pulse: false,
    muted: true,
  },
};
