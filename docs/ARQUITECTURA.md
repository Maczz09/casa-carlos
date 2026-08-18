# Casa Carlos — Arquitectura orientada a servicios

Sistema de gestión de hospedaje. Ejecutable local (`CasaCarlos.exe`) que levanta un
servidor en la PC de recepción; el resto de pantallas (kiosco del cliente, tablet del
admin) se conectan por la red local con un navegador.

---

## 1. Decisión de arquitectura

**SOA en modulith, con ruta de extracción a microservicios.**

Trece servicios con fronteras duras — contrato público, esquema de datos propio, cero
imports cruzados — que corren **in-process** dentro de un único ejecutable. La
comunicación entre servicios pasa por un **bus de eventos tipado** y por **puertos**
(interfaces), nunca por llamadas directas a la implementación de otro servicio.

### Por qué no microservicios multi-proceso hoy

| Factor | Microservicios reales | Modulith SOA |
|---|---|---|
| Despliegue | 12 procesos, orquestador, puertos | 1 `.exe`, doble clic |
| Transacciones (venta+pago+caja) | Saga distribuida, compensaciones | Transacción ACID local |
| Fallo parcial | Cuarto ocupado sin venta registrada | Imposible por diseño |
| Latencia kiosco↔recepción | Red + serialización | Memoria |
| Recuperación tras corte de luz | Reconciliar 12 estados | Un archivo, un WAL |
| Personal técnico requerido | DevOps | Ninguno |

Un hospedaje de 9 cuartos con 2–3 recepcionistas no tiene el problema que los
microservicios resuelven (escalar equipos y despliegues independientes), pero sí tiene
de lleno los problemas que introducen.

### Ruta de extracción

La frontera ya está puesta. Para sacar un servicio a proceso propio:

1. El servicio ya expone `contract.ts` (tipos + puerto). No cambia.
2. Se reemplaza `InProcessBus` por `NatsBus` — misma interfaz `EventBus`.
3. Se reemplaza el binding local del puerto por un cliente HTTP/gRPC generado.
4. El esquema de datos ya está separado por prefijo de tabla → migra a su propia BD.

Ningún archivo de dominio se toca. Candidatos naturales al primer corte:
`reporting`, `notifications`.

---

## 2. Mapa de servicios

| # | Servicio | Responsabilidad | Publica eventos | Consume |
|---|---|---|---|---|
| S1 | `identity` | Usuarios, roles, PIN, sesiones, dispositivos kiosco | `user.*`, `session.*` | — |
| S2 | `rooms` | Pisos, cuartos, categorías, estado físico, semáforo de piso | `room.status_changed`, `room.cleaning_*` | `stay.*` |
| S3 | `pricing` | Temporadas, franjas horarias, tarifas, escala de noches, cargos extra | `rate.updated` | — |
| S4 | `stays` | Reservas, estadías, check-in/out, tolerancias, extensiones | `stay.*` | `payment.accepted`, `tick.*` |
| S5 | `inventory` | Productos, código de barras, stock, kardex, despacho a cuarto | `inventory.*` | `sale.closed` |
| S6 | `sales` | Cotizaciones, órdenes, líneas, adicionales pre/post pago, boletas | `sale.*` | `stay.*`, `inventory.dispatched`, `rate.*` |
| S7 | `payments` | Métodos, pago híbrido, validación de recepción, cuentas de cobro | `payment.*` | `sale.opened` |
| S8 | `cashbox` | Plantillas de turno, apertura/cierre, arqueo, movimientos | `shift.*` | `payment.accepted`, `sale.*` |
| S9 | `reporting` | Dashboard, métricas, comparativas, export PDF/Excel | — | todos (proyecciones) |
| S10 | `notifications` | WhatsApp, alertas en pantalla, plantillas, cola con reintento | `notification.*` | `stay.overstayed`, `inventory.low_stock`, `shift.closed` |
| S11 | `scheduler` | Temporizadores **durables**: limpieza 5', tolerancia 15', checkout | `tick.*`, `timer.fired` | `stay.*`, `room.*` |
| S12 | `audit` | Bitácora inmutable de cambios en ventas, reservas y tarifas | — | todos |
| S13 | `billing` | Facturación electrónica SUNAT (boleta/factura), envío a OSE/PSE, CDR | `billing.*` | `sale.paid` |
| GW | `gateway` | HTTP + WebSocket, BFF por rol, sesión espejo kiosco↔recepción **en tiempo real** | — | todos |

### Reglas de frontera

- Un servicio **solo** importa `@casacarlos/contracts` y su propio código.
- Prohibido `import { X } from '../sales/...'` desde otro servicio. Lo impone ESLint
  (`no-restricted-imports`) y la estructura del workspace.
- Las tablas llevan prefijo del servicio (`sales_`, `stays_`, `rooms_`…). Un servicio
  solo escribe en sus tablas.
- Lectura de datos ajenos: por puerto o por proyección propia alimentada por eventos.
  Nunca por `JOIN` cruzado.

---

## 3. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Runtime | Node 24 LTS + TypeScript 5.9 (strict) | Ya instalado en la máquina |
| HTTP | Fastify 5 | Rápido, plugins = módulos, esquemas nativos |
| Realtime | `ws` sobre el mismo servidor Fastify (`@fastify/websocket`) | **Todo el estado en vivo** — semáforo de cuartos, contadores, espejo kiosco↔recepción, cola de caja — viaja por WebSocket, no por polling |
| BD | **SQLite (better-sqlite3) en modo WAL** | Cero instalación, un archivo, respaldo = copiar archivo |
| ORM/migraciones | Drizzle ORM + drizzle-kit | TS puro, migraciones versionadas, sin runtime pesado |
| Validación | Zod (compartido cliente/servidor) | Un solo contrato de tipos |
| Frontend | React 19 + Vite + TanStack Query + Tailwind | Tres SPAs, un build |
| PDF | pdfmake | JS puro, sin Chromium — boletas y reportes |
| Excel | ExcelJS | Formato, fórmulas, múltiples hojas |
| Empaquetado | `@yao-pkg/pkg` → `CasaCarlos.exe` | Incluye binario nativo de SQLite y assets |
| Arranque automático | `node-windows` (servicio de Windows) | Sobrevive reinicios y cortes de luz |
| WhatsApp | `whatsapp-web.js` (sesión propia, sin costo por mensaje) | Decisión del cliente; riesgo de baneo mitigado. Ver §7 |
| Scanner | HID keyboard-wedge, listener con prefijo/sufijo | El scanner del all-in-one "teclea"; sin driver |
| Facturación electrónica | Cliente SOAP/REST contra OSE/PSE (a definir proveedor) | Boleta y factura electrónica SUNAT. Ver §8 |

### Por qué SQLite y no PostgreSQL

En un modulith hay **un solo proceso escritor**. SQLite en WAL sostiene lecturas
concurrentes ilimitadas y una escritura a la vez — muy por encima de lo que generan
9 cuartos y 3 pantallas. A cambio: cero instalación para el dueño, respaldo copiando
un archivo, y arranque instantáneo.

**Cuándo migrar a PostgreSQL:** al extraer el primer servicio a proceso propio, o al
abrir una segunda sede. Drizzle cambia de dialecto sin tocar la lógica de dominio;
por eso las consultas van por el repositorio, nunca SQL crudo esparcido.

---

## 4. Estructura del repositorio

```
casa-carlos/
├─ apps/
│  ├─ server/                 # ensambla servicios + gateway → CasaCarlos.exe
│  ├─ web-admin/              # SPA administrador
│  ├─ web-reception/          # SPA recepción
│  └─ web-kiosk/              # SPA cliente (kiosco / tablet)
├─ packages/
│  ├─ contracts/              # tipos Zod + interfaces de puerto + nombres de evento
│  ├─ bus/                    # EventBus: InProcessBus | NatsBus
│  ├─ db/                     # conexión, migraciones, esquema por servicio
│  ├─ ui/                     # design system compartido
│  └─ money/                  # aritmética en céntimos (nunca float)
├─ services/
│  ├─ identity/  rooms/  pricing/  stays/  inventory/  sales/
│  ├─ payments/  cashbox/  reporting/  notifications/  scheduler/  audit/  billing/
│  └─ (cada uno) ├─ contract.ts   # público — lo único importable
│                ├─ domain/       # entidades, reglas puras, sin I/O
│                ├─ app/          # casos de uso (1 archivo = 1 UC)
│                ├─ infra/        # repositorios Drizzle, adaptadores
│                └─ index.ts      # register(bus, deps) → puerto
└─ docs/
```

Cada caso de uso del catálogo es **un archivo** en `services/<s>/app/`. El ID del UC
es el nombre del archivo: `RES-10-detectar-exceso.ts`.

---

## 5. Bus de eventos

```ts
// packages/contracts/events.ts
export type DomainEvents = {
  'stay.reserved':        { stayId: string; roomId: string; from: string; to: string }
  'stay.checked_in':      { stayId: string; roomId: string; mode: RentalMode; at: string }
  'stay.tolerance_started': { stayId: string; roomId: string; deadline: string }
  'stay.overstayed':      { stayId: string; roomId: string; minutesOver: number }
  'stay.checked_out':     { stayId: string; roomId: string; at: string }
  'room.status_changed':  { roomId: string; from: RoomStatus; to: RoomStatus }
  'sale.opened':          { saleId: string; shiftId: string; userId: string }
  'sale.line_added':      { saleId: string; lineId: string; phase: 'PRE_PAGO'|'POST_PAGO' }
  'sale.paid':            { saleId: string; total: number }
  'payment.accepted':     { paymentId: string; saleId: string; total: number }
  'inventory.low_stock':  { productId: string; stock: number; min: number }
  'shift.closed':         { shiftId: string; difference: number }
  // …
}
```

Entrega **at-least-once** con outbox: el evento se escribe en `bus_outbox` dentro de la
misma transacción que el cambio de estado, y se despacha después del commit. Los
consumidores son idempotentes por `eventId`.

---

## 6. Temporizadores durables

Crítico: la limpieza de 5 min, la tolerancia de 15 min y el vencimiento de estadía
**no pueden vivir en `setTimeout`**. Un corte de luz los borraría.

- Toda deadline se guarda como `timestamp` en la fila (`stays.ends_at`,
  `rooms.cleaning_until`).
- `scheduler` corre cada 15 s: consulta deadlines vencidas, emite el evento, marca
  `fired_at`. Idempotente.
- Al arrancar el `.exe` se reconstruye todo el estado desde los timestamps. Si el
  sistema estuvo apagado 2 horas, al encender detecta y notifica los excesos ocurridos.

---

## 7. Integración WhatsApp — decisión: `whatsapp-web.js`

Confirmado con el cliente: sin costo por mensaje, usando `whatsapp-web.js` sobre una
sesión de WhatsApp Web vinculada a un celular dedicado del hotel (no el personal del
dueño). Queda documentado el riesgo — Meta puede banear el número si detecta tráfico
automatizado — y se mitiga así:

- **Número dedicado y desechable**, nunca el personal del administrador.
- **Envíos de baja frecuencia**: solo alertas puntuales (exceso de tiempo, stock bajo,
  cierre de turno con diferencia), nunca campañas ni mensajería masiva.
- El servicio `notifications` encapsula el cliente detrás del mismo puerto
  (`WhatsAppPort`) que usaría Cloud API. Si el número se banea o el dueño luego
  acepta pagar por Cloud API, se cambia el adaptador sin tocar el resto del sistema.
- Sesión persistida en disco (`LocalAuth` de `whatsapp-web.js`) para no re-escanear el
  QR en cada arranque del `.exe`.
- Corre en un **proceso hijo separado** (Puppeteer/Chromium embebido) supervisado por
  `notifications`, no en el hilo principal del servidor — un crash del navegador
  headless no debe tumbar la venta ni el check-in en curso.

**El sistema no depende de WhatsApp para operar:** toda alerta se muestra primero en
pantalla de recepción y admin. WhatsApp es un canal adicional con cola y reintento;
si no hay internet o la sesión se cae, la alerta local igual ocurre y el mensaje se
reintenta al reconectar.

---

## 8. Facturación electrónica SUNAT — decisión: en alcance

Confirmado en alcance. `sales` sigue siendo dueño de la venta; `billing` es un
servicio aparte que la traduce a boleta/factura electrónica y la envía a un OSE
(Operador de Servicios Electrónicos) — la vía más simple para un negocio pequeño,
sin tener que homologarse directo con SUNAT como PSE.

- Al `sale.paid`, `billing` genera el XML UBL 2.1, lo firma y lo envía al OSE elegido
  (candidatos a evaluar: Nubefact, Facturador SUNAT, SUNAT Operaciones en Línea
  directo — pendiente de decidir proveedor y costo mensual con el cliente).
- Guarda el **CDR** (Constancia de Recepción) que devuelve el OSE; ese es el
  comprobante de que SUNAT aceptó el documento.
- Si el envío falla (sin internet, OSE caído), la boleta interna en PDF **igual se
  emite y el cuarto se entrega** — la declaración electrónica queda en cola y
  reintenta. La operación del hotel nunca se bloquea por un problema de SUNAT.
- Requiere del cliente: certificado digital vigente, usuario SOL, y clave de OSE.
  Esto se configura en `ADM-01` (datos del hospedaje) antes de emitir el primer
  comprobante electrónico.
- Serie y correlativo (`sales_ventas.serie`, `.correlativo`) ya están preparados para
  ser también la serie SUNAT (ej. `B001`), sin cambio de esquema.

---

## 9. Seguridad y datos personales

- Roles: `ADMIN`, `RECEPCIONISTA`, `KIOSCO` (token de dispositivo, sin persona).
- **El kiosco jamás recibe datos de cliente.** No es que la UI los oculte: el BFF del
  kiosco no los serializa. El cliente ve `OCUPADO`, nunca un nombre.
- Nombres y DNI se guardan cifrados en reposo (`better-sqlite3-multiple-ciphers`).
- Auditoría inmutable: modificar una venta o reserva siempre deja rastro de quién, qué
  y cuándo. Requisito directo de "permitir siempre modificar ventas y reservas".
- Respaldo automático diario del archivo `.db` a carpeta configurable (+ USB/nube).

---

## 10. Roadmap por fases

| Fase | Alcance | Semanas |
|---|---|---|
| **F1 — Núcleo operable** | `identity`, `rooms`, `pricing`, `stays`, `sales`, `payments` (efectivo + Yape) + pantalla recepción, todo en vivo por WebSocket | 4 |
| **F2 — Kiosco** | SPA cliente, espejo en vivo, todos los métodos de pago, híbrido, QR y CCI | 2 |
| **F3 — Bodega y caja** | `inventory` con scanner, adicionales pre/post pago, `cashbox`, cuadre y turnos | 3 |
| **F4 — Inteligencia** | `reporting`, dashboard con comparativas, PDF/Excel, `notifications` WhatsApp (`whatsapp-web.js`) | 3 |
| **F5 — Facturación electrónica** | Servicio `billing`, integración OSE, CDR, contingencia | 2 |
| **F6 — Endurecimiento** | Respaldos, servicio de Windows, instalador, capacitación | 1 |

F1 ya es un sistema que reemplaza el cuaderno.
