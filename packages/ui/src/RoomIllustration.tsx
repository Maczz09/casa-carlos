interface RoomIllustrationProps {
  beds: number;
  hasFan: boolean;
  floorFill: string;
  muted?: boolean;
}

/*
 * Cada color es un `var()` con el valor original como fallback: las apps que
 * definen tokens de tema (recepción) obtienen una versión clara/oscura, y las
 * que no (el kiosco) siguen viéndose exactamente igual que antes.
 */
const WALL = "var(--room-wall, #78716C)";
const BED = "var(--room-bed, #FFFFFF)";
const BED_STROKE = "var(--room-bed-stroke, #57534E)";
const LINEN = "var(--room-linen, #8C8378)";
const PILLOW = "var(--room-pillow, #EDE7DD)";
const WOOD = "var(--room-wood, #D9C9A8)";
const LAMP = "var(--room-lamp, #F3E7C9)";
const FAN_HUB = "var(--room-fan-hub, #A8A29E)";
const FAN_BLADE = "var(--room-fan-blade, #D6D3D1)";

function Fan({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
  const bladeLen = 13 * scale;
  const rx = 4.2 * scale;
  const ry = 11 * scale;
  return (
    <g>
      {[0, 90, 180, 270].map((angle) => (
        <ellipse
          key={angle}
          cx={cx}
          cy={cy - bladeLen + ry}
          rx={rx}
          ry={ry}
          fill={FAN_BLADE}
          stroke={WALL}
          strokeWidth={1}
          opacity={0.9}
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={3.4 * scale} fill={FAN_HUB} stroke={BED_STROKE} strokeWidth={1} />
    </g>
  );
}

/** Cabecera de la cama — el detalle que hace que se lea como plano y no como una caja. */
function Headboard({ x, y, width }: { x: number; y: number; width: number }) {
  return <rect x={x} y={y} width={width} height={7} rx={3.5} fill={WOOD} stroke={LINEN} strokeWidth={1.1} />;
}

function SingleBed() {
  return (
    <g>
      <Headboard x={26} y={14} width={100} />
      <rect x={26} y={20} width={100} height={78} rx={10} fill={BED} stroke={BED_STROKE} strokeWidth={2} />
      <rect x={34} y={28} width={38} height={22} rx={8} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
      <rect x={78} y={28} width={38} height={22} rx={8} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
      {/* Doblez de la sábana */}
      <path d="M26,62 H126" stroke={LINEN} strokeWidth={1.2} opacity={0.55} />
      <path d="M36,80 Q76,70 116,80" stroke={LINEN} strokeWidth={1.5} fill="none" opacity={0.7} />
    </g>
  );
}

function TwinBeds() {
  return (
    <g>
      <Headboard x={18} y={14} width={76} />
      <rect x={18} y={20} width={76} height={70} rx={10} fill={BED} stroke={BED_STROKE} strokeWidth={2} />
      <rect x={26} y={28} width={60} height={20} rx={8} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
      <path d="M18,58 H94" stroke={LINEN} strokeWidth={1.2} opacity={0.55} />
      <path d="M26,76 Q56,68 86,76" stroke={LINEN} strokeWidth={1.5} fill="none" opacity={0.7} />

      <Headboard x={126} y={14} width={76} />
      <rect x={126} y={20} width={76} height={70} rx={10} fill={BED} stroke={BED_STROKE} strokeWidth={2} />
      <rect x={134} y={28} width={60} height={20} rx={8} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
      <path d="M126,58 H202" stroke={LINEN} strokeWidth={1.2} opacity={0.55} />
      <path d="M134,76 Q164,68 194,76" stroke={LINEN} strokeWidth={1.5} fill="none" opacity={0.7} />
    </g>
  );
}

/**
 * Plano del cuarto visto desde arriba: cama(s) según `beds`, velador con lámpara,
 * ventilador de techo solo si `hasFan`, y el arco de la puerta abajo a la izquierda.
 * Un recepcionista o un huésped tiene que poder ver de un vistazo qué tiene el
 * cuarto, no solo si está libre. Compartido entre web-reception y web-kiosk.
 */
export function RoomIllustration({ beds, hasFan, floorFill, muted }: RoomIllustrationProps) {
  return (
    <svg
      viewBox="0 0 220 130"
      className="h-full w-full"
      style={muted ? { filter: "saturate(0.35) brightness(1.03)" } : undefined}
      aria-hidden="true"
    >
      <rect x={6} y={6} width={208} height={118} rx={16} fill={floorFill} stroke={WALL} strokeWidth={2} />

      {beds >= 2 ? <TwinBeds /> : <SingleBed />}

      {beds >= 2 ? (
        <g>
          <rect x={100} y={38} width={22} height={22} rx={4} fill={WOOD} stroke={LINEN} strokeWidth={1.3} />
          <circle cx={111} cy={45} r={6.5} fill={LAMP} stroke={LINEN} strokeWidth={1.2} />
          <circle cx={111} cy={45} r={1.5} fill={LINEN} />
        </g>
      ) : (
        <g>
          <rect x={136} y={36} width={26} height={26} rx={4} fill={WOOD} stroke={LINEN} strokeWidth={1.3} />
          <circle cx={149} cy={43} r={7} fill={LAMP} stroke={LINEN} strokeWidth={1.2} />
          <circle cx={149} cy={43} r={1.6} fill={LINEN} />
        </g>
      )}

      {/* Puerta: hueco en la pared + arco de apertura */}
      <g opacity={0.75}>
        <path d="M14,124 V100" stroke={floorFill} strokeWidth={4} />
        <path d="M14,100 A24,24 0 0 1 38,124" fill="none" stroke={LINEN} strokeWidth={1.3} strokeDasharray="3 3" />
        <path d="M14,100 V124" stroke={LINEN} strokeWidth={1.6} />
      </g>

      {hasFan && <Fan cx={beds >= 2 ? 110 : 188} cy={beds >= 2 ? 108 : 28} scale={beds >= 2 ? 0.85 : 0.95} />}
    </svg>
  );
}
