interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Disponible */
export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 10.2 L8 14.2 L16 5.3" />
    </svg>
  );
}

/** Reservado */
export function IconBookmark({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 3.5h8a.7.7 0 0 1 .7.7v12l-4.7-3.3-4.7 3.3v-12a.7.7 0 0 1 .7-.7Z" />
    </svg>
  );
}

/** Ocupado */
export function IconBed({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2.5 15.5v-8a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5v2.6" />
      <path d="M2.5 15.5V13a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v2.5" />
      <path d="M17.5 12v-3a2 2 0 0 0-2-2H9.2" />
      <path d="M2.5 15.5h15" />
    </svg>
  );
}

/** En tolerancia */
export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="10" cy="10.5" r="7" />
      <path d="M10 6.3v4.2l3 2" />
    </svg>
  );
}

/** Excedido */
export function IconAlertTriangle({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10 3.2 18 16.8H2Z" />
      <path d="M10 8.3v4" />
      <circle cx="10" cy="14.6" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** En limpieza */
export function IconBroom({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 4.5 12.5 13" />
      <path d="M11.5 12 8.7 18" />
      <path d="M12.2 12.4 11.8 18.5" />
      <path d="M13 12.7 14.7 18.2" />
      <path d="M13.7 12.2 16.7 17" />
      <path d="M8.7 18 Q12.2 19.5 16.7 17" />
    </svg>
  );
}

/** Fuera de servicio */
export function IconBan({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" />
      <path d="M5.2 5.2 14.8 14.8" />
    </svg>
  );
}

/** Efectivo */
export function IconCash({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <circle cx="10" cy="10" r="2.4" />
      <path d="M5 10h.01M15 10h.01" />
    </svg>
  );
}

/** Billetera digital */
export function IconWallet({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h10A1.5 1.5 0 0 1 16 6.5v7A1.5 1.5 0 0 1 14.5 15h-10A1.5 1.5 0 0 1 3 13.5v-7Z" />
      <path d="M13 10.2h2.5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H13a1.1 1.1 0 0 0 0 2.2Z" />
    </svg>
  );
}

/** Transferencia bancaria */
export function IconBank({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2.5 7.5 10 3l7.5 4.5" />
      <path d="M3.5 7.5h13v7h-13z" />
      <path d="M3 16h14M6.5 7.5v7M10 7.5v7M13.5 7.5v7" />
    </svg>
  );
}

/** Combinar métodos de pago */
export function IconCombine({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="7" cy="7" r="4" />
      <circle cx="13" cy="13" r="4" />
    </svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12.5 4.5 6 10l6.5 5.5" />
    </svg>
  );
}

/** Bienvenida / pantalla de espera */
export function IconDoor({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4.5" y="2.5" width="9" height="15" rx="1" />
      <path d="M10.5 10.2h.01" />
      <path d="M13.5 3v14M4.5 17h11" />
    </svg>
  );
}

export function IconUser({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="3" />
      <path d="M3.5 16.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/* ---------- Navegación / chrome del panel ---------- */

export function IconGrid({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.8" y="2.8" width="6" height="6" rx="1.4" />
      <rect x="11.2" y="2.8" width="6" height="6" rx="1.4" />
      <rect x="2.8" y="11.2" width="6" height="6" rx="1.4" />
      <rect x="11.2" y="11.2" width="6" height="6" rx="1.4" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.8" y="4" width="14.4" height="13.2" rx="2" />
      <path d="M2.8 8.2h14.4M6.6 2.6v2.8M13.4 2.6v2.8" />
    </svg>
  );
}

export function IconBox({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10 2.6 17.2 6.4v7.2L10 17.4 2.8 13.6V6.4Z" />
      <path d="M2.8 6.4 10 10.2l7.2-3.8M10 10.2v7.2" />
    </svg>
  );
}

export function IconReceipt({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4.2 2.6h11.6v14.8l-2.3-1.4-2.3 1.4-2.3-1.4-2.4 1.4-2.3-1.4Z" />
      <path d="M7.2 6.6h5.6M7.2 9.8h5.6" />
    </svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 17h14" />
      <path d="M5.6 17V9.4M10 17V4.2M14.4 17v-5.4" />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5.4 8.2a4.6 4.6 0 0 1 9.2 0c0 3.4 1.2 4.6 1.2 4.6H4.2s1.2-1.2 1.2-4.6Z" />
      <path d="M8.4 15.4a1.8 1.8 0 0 0 3.2 0" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10 4.2v11.6M4.2 10h11.6" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.2v1.8M10 16v1.8M17.8 10H16M4 10H2.2M15.5 4.5l-1.3 1.3M5.8 14.2l-1.3 1.3M15.5 15.5l-1.3-1.3M5.8 5.8 4.5 4.5" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M16.2 11.8A6.8 6.8 0 0 1 8.2 3.8a6.8 6.8 0 1 0 8 8Z" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3.2 5.6h13.6M3.2 10h13.6M3.2 14.4h13.6" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5.2 7.8 10 12.4l4.8-4.6" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7.6 4.8 12.4 10l-4.8 5.2" />
    </svg>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M8 17H4.6a1.4 1.4 0 0 1-1.4-1.4V4.4A1.4 1.4 0 0 1 4.6 3H8" />
      <path d="M12.8 13.4 16.8 10l-4-3.4M16.4 10H7.6" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="5.6" />
      <path d="M13.2 13.2 17 17" />
    </svg>
  );
}

export function IconX({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5.2 5.2 14.8 14.8M14.8 5.2 5.2 14.8" />
    </svg>
  );
}

export function IconPrinter({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5.6 7.4V2.8h8.8v4.6" />
      <path d="M5.6 14.2H3.8a1.4 1.4 0 0 1-1.4-1.4V8.8a1.4 1.4 0 0 1 1.4-1.4h12.4a1.4 1.4 0 0 1 1.4 1.4v4a1.4 1.4 0 0 1-1.4 1.4h-1.8" />
      <path d="M5.6 11.6h8.8v5.6H5.6Z" />
    </svg>
  );
}
