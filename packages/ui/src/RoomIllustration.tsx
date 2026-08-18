interface RoomIllustrationProps {
  beds: number;
  hasFan: boolean;
  floorFill: string;
  muted?: boolean;
}

const WALL = "#78716C";
const BED_STROKE = "#57534E";
const LINEN_STROKE = "#8C8378";
const PILLOW = "#EDE7DD";
const WOOD = "#D9C9A8";
const LAMP = "#F3E7C9";
const FAN_HUB = "#A8A29E";
const FAN_BLADE = "#D6D3D1";

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

function SingleBed() {
  return (
    <g>
      <rect x={26} y={20} width={100} height={78} rx={10} fill="#FFFFFF" stroke={BED_STROKE} strokeWidth={2} />
      <rect x={34} y={28} width={38} height={22} rx={8} fill={PILLOW} stroke={LINEN_STROKE} strokeWidth={1} />
      <rect x={78} y={28} width={38} height={22} rx={8} fill={PILLOW} stroke={LINEN_STROKE} strokeWidth={1} />
      <path d="M36,80 Q76,70 116,80" stroke={LINEN_STROKE} strokeWidth={1.5} fill="none" opacity={0.7} />
    </g>
  );
}

function TwinBeds() {
  return (
    <g>
      <rect x={18} y={20} width={76} height={70} rx={10} fill="#FFFFFF" stroke={BED_STROKE} strokeWidth={2} />
      <rect x={26} y={28} width={60} height={20} rx={8} fill={PILLOW} stroke={LINEN_STROKE} strokeWidth={1} />
      <path d="M26,76 Q56,68 86,76" stroke={LINEN_STROKE} strokeWidth={1.5} fill="none" opacity={0.7} />

      <rect x={126} y={20} width={76} height={70} rx={10} fill="#FFFFFF" stroke={BED_STROKE} strokeWidth={2} />
      <rect x={134} y={28} width={60} height={20} rx={8} fill={PILLOW} stroke={LINEN_STROKE} strokeWidth={1} />
      <path d="M134,76 Q164,68 194,76" stroke={LINEN_STROKE} strokeWidth={1.5} fill="none" opacity={0.7} />
    </g>
  );
}

/**
 * Top-down room floor plan: bed(s) sized by `beds`, a nightstand with a lamp,
 * and a ceiling fan only when `hasFan` — a receptionist or guest should be
 * able to tell what a room actually has at a glance, not just whether it's
 * free. Shared between web-reception and web-kiosk.
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
          <rect x={100} y={38} width={22} height={22} rx={4} fill={WOOD} stroke={LINEN_STROKE} strokeWidth={1.3} />
          <circle cx={111} cy={45} r={6.5} fill={LAMP} stroke={LINEN_STROKE} strokeWidth={1.2} />
          <circle cx={111} cy={45} r={1.5} fill={LINEN_STROKE} />
        </g>
      ) : (
        <g>
          <rect x={136} y={36} width={26} height={26} rx={4} fill={WOOD} stroke={LINEN_STROKE} strokeWidth={1.3} />
          <circle cx={149} cy={43} r={7} fill={LAMP} stroke={LINEN_STROKE} strokeWidth={1.2} />
          <circle cx={149} cy={43} r={1.6} fill={LINEN_STROKE} />
        </g>
      )}

      {hasFan && <Fan cx={beds >= 2 ? 110 : 188} cy={beds >= 2 ? 108 : 28} scale={beds >= 2 ? 0.85 : 0.95} />}
    </svg>
  );
}
