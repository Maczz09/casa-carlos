import type { RoomStatus } from "@casacarlos/contracts";
import { IconAlertTriangle, IconBan, IconBed, IconBookmark, IconBroom, IconCheck, IconClock } from "./icons.js";

export interface StatusStyle {
  label: string;
  icon: typeof IconCheck;
  accent: string; // top bar + icon color
  badgeBg: string;
  badgeText: string;
  floorFill: string; // the room illustration's floor tone for this status
  pulse: boolean;
  muted: boolean;
}

export const STATUS_STYLE: Record<RoomStatus, StatusStyle> = {
  DISPONIBLE: {
    label: "Disponible",
    icon: IconCheck,
    accent: "#0D9488",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    floorFill: "#F5F1E8",
    pulse: false,
    muted: false,
  },
  RESERVADO: {
    label: "Reservado",
    icon: IconBookmark,
    accent: "#7C3AED",
    badgeBg: "bg-violet-50",
    badgeText: "text-violet-700",
    floorFill: "#F1EDFB",
    pulse: false,
    muted: false,
  },
  OCUPADO: {
    label: "Ocupado",
    icon: IconBed,
    accent: "#E11D48",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    floorFill: "#FCEEF0",
    pulse: false,
    muted: false,
  },
  EN_TOLERANCIA: {
    label: "En tolerancia",
    icon: IconClock,
    accent: "#D97706",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    floorFill: "#FDF3E1",
    pulse: false,
    muted: false,
  },
  EXCEDIDO: {
    label: "Excedido",
    icon: IconAlertTriangle,
    accent: "#B91C1C",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    floorFill: "#FBE6E6",
    pulse: true,
    muted: false,
  },
  LIMPIEZA: {
    label: "En limpieza",
    icon: IconBroom,
    accent: "#0284C7",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
    floorFill: "#EFF0EE",
    pulse: false,
    muted: true,
  },
  FUERA_DE_SERVICIO: {
    label: "Fuera de servicio",
    icon: IconBan,
    accent: "#78716C",
    badgeBg: "bg-stone-100",
    badgeText: "text-stone-600",
    floorFill: "#EBE8E4",
    pulse: false,
    muted: true,
  },
};
