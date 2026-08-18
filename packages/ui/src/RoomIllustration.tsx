interface RoomIllustrationProps {
  beds: number;
  /** Cantidad de ventiladores — no un booleano de "tiene o no tiene", el SVG dibuja tantos como este número. */
  fans: number;
  floorFill: string;
  muted?: boolean;
}

/*
 * Cada color es un `var()` con el valor original como fallback: las apps que
 * definen tokens de tema (recepción, kiosco) obtienen una versión clara/oscura,
 * y cualquier consumidor futuro que no defina tokens sigue viéndose igual.
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

/** Franja del techo reservada para los ventiladores — separada del área de camas para que nunca se pisen sin importar cuántas haya de cada uno. */
const CEILING = { top: 10, bottom: 34, left: 18, right: 202 };
const FLOOR_AREA = { top: 38, bottom: 124, left: 14, right: 206 };
const MAX_BEDS_PER_ROW = 3;

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

/** N ventiladores repartidos en la franja del techo — se van achicando para que quepan sin superponerse. */
function FansRow({ count }: { count: number }) {
  if (count <= 0) return null;
  const width = CEILING.right - CEILING.left;
  const cy = (CEILING.top + CEILING.bottom) / 2;
  const scale = Math.max(0.32, Math.min(0.6, 0.6 - (count - 1) * 0.06));
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const cx = CEILING.left + width * ((i + 0.5) / count);
        return <Fan key={i} cx={cx} cy={cy} scale={scale} />;
      })}
    </g>
  );
}

/** Una cama a medida — cabecera + colchón + almohada(s) + doblez de sábana, todo proporcional al ancho que le toca. */
function Bed({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const headboardH = Math.max(5, height * 0.09);
  const pillowW = Math.min(width * 0.42, 40);
  const pillowH = Math.min(height * 0.28, 24);
  const twoPillows = width >= 70;
  return (
    <g>
      <rect x={x} y={y - headboardH} width={width} height={headboardH} rx={headboardH / 2} fill={WOOD} stroke={LINEN} strokeWidth={1.1} />
      <rect x={x} y={y} width={width} height={height} rx={Math.min(10, width * 0.09)} fill={BED} stroke={BED_STROKE} strokeWidth={2} />
      {twoPillows ? (
        <>
          <rect x={x + width * 0.08} y={y + height * 0.1} width={pillowW} height={pillowH} rx={pillowH / 2.5} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
          <rect x={x + width - pillowW - width * 0.08} y={y + height * 0.1} width={pillowW} height={pillowH} rx={pillowH / 2.5} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
        </>
      ) : (
        <rect x={x + (width - pillowW) / 2} y={y + height * 0.1} width={pillowW} height={pillowH} rx={pillowH / 2.5} fill={PILLOW} stroke={LINEN} strokeWidth={1} />
      )}
      <path d={`M${x + width * 0.06},${y + height * 0.62} Q${x + width / 2},${y + height * 0.5} ${x + width * 0.94},${y + height * 0.62}`} stroke={LINEN} strokeWidth={1.4} fill="none" opacity={0.7} />
    </g>
  );
}

/** Reparte N camas en una o dos filas dentro del área disponible, sin superponerse sin importar cuántas sean. */
function BedsGrid({ count }: { count: number }) {
  const n = Math.max(1, count);
  const rows = n > MAX_BEDS_PER_ROW ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const gap = 8;
  const rowGap = 10;
  const rowHeight = (FLOOR_AREA.bottom - FLOOR_AREA.top - (rows - 1) * rowGap) / rows;
  const totalWidth = FLOOR_AREA.right - FLOOR_AREA.left;

  const beds: { x: number; y: number; width: number; height: number }[] = [];
  let remaining = n;
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, remaining);
    remaining -= inRow;
    const bedWidth = (totalWidth - (inRow - 1) * gap) / inRow;
    for (let i = 0; i < inRow; i++) {
      beds.push({
        x: FLOOR_AREA.left + i * (bedWidth + gap),
        y: FLOOR_AREA.top + row * (rowHeight + rowGap) + rowHeight * 0.1,
        width: bedWidth,
        height: rowHeight * 0.82,
      });
    }
  }

  return (
    <g>
      {beds.map((b, i) => (
        <Bed key={i} {...b} />
      ))}
    </g>
  );
}

/** Velador con lámpara — solo cuando hay espacio real para no amontonar cuartos con muchas camas. */
function Nightstand({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.16} fill={WOOD} stroke={LINEN} strokeWidth={1.3} />
      <circle cx={x + size / 2} cy={y + size * 0.28} r={size * 0.26} fill={LAMP} stroke={LINEN} strokeWidth={1.2} />
      <circle cx={x + size / 2} cy={y + size * 0.28} r={size * 0.06} fill={LINEN} />
    </g>
  );
}

/**
 * Plano del cuarto visto desde arriba, totalmente dinámico: `beds` camas
 * repartidas en el piso sin superponerse, `fans` ventiladores en la franja
 * del techo — ambos números vienen de la categoría del cuarto, no hay casos
 * fijos para 1 o 2. Compartido entre web-reception y web-kiosk.
 */
export function RoomIllustration({ beds, fans, floorFill, muted }: RoomIllustrationProps) {
  const bedCount = Math.max(1, Math.round(beds));
  const fanCount = Math.max(0, Math.round(fans));
  const showNightstand = bedCount <= 3;

  return (
    <svg
      viewBox="0 0 220 130"
      className="h-full w-full"
      style={muted ? { filter: "saturate(0.35) brightness(1.03)" } : undefined}
      aria-hidden="true"
    >
      <rect x={6} y={6} width={208} height={118} rx={16} fill={floorFill} stroke={WALL} strokeWidth={2} />

      <FansRow count={fanCount} />
      <BedsGrid count={bedCount} />
      {showNightstand && <Nightstand x={FLOOR_AREA.right - 24} y={FLOOR_AREA.bottom - 26} size={22} />}

      {/* Puerta: hueco en la pared + arco de apertura */}
      <g opacity={0.75}>
        <path d="M14,124 V100" stroke={floorFill} strokeWidth={4} />
        <path d="M14,100 A24,24 0 0 1 38,124" fill="none" stroke={LINEN} strokeWidth={1.3} strokeDasharray="3 3" />
        <path d="M14,100 V124" stroke={LINEN} strokeWidth={1.6} />
      </g>
    </svg>
  );
}
