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
