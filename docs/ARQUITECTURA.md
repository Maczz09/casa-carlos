# Hospedaje Carlos — Arquitectura orientada a servicios

Sistema de gestión de hospedaje. Un servicio local de Windows (`CasaCarlos`) mantiene
el servidor y la base de datos activos; `HospedajeCarlos.exe` ofrece la interfaz nativa
de recepción y, con `--kiosk`, la pantalla completa del cliente. Tablets y equipos
secundarios todavía pueden conectarse por la red local con un navegador.

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
| S13 | `billing` | Facturación electrónica SUNAT (boleta/factura/notas), directo sin OSE/PSE, CDR | — | — |
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
| BD | **SQLite (`node:sqlite` nativo de Node) en modo WAL** | Cero instalación — `better-sqlite3` no tiene binario prebuilt para Windows/Node actual, `node:sqlite` no necesita compilar nada. Respaldo vía `VACUUM INTO` (consolida el WAL en un archivo limpio, no basta con copiar `.db` a secas — ver §9) |
| ORM/migraciones | Drizzle ORM + drizzle-kit | TS puro, migraciones versionadas, sin runtime pesado |
| Validación | Zod (compartido cliente/servidor) | Un solo contrato de tipos |
| Frontend | React 19 + Vite + TanStack Query + Tailwind | SPAs de recepción y kiosco, compartidas entre escritorio y acceso por red |
| Escritorio | Tauri 2 + Rust + WebView2 | Ejecutable pequeño, ventana nativa, kiosco fullscreen, instancia única, arranque/recuperación del servicio y ventanas de impresión; Rust/MinGW solo existen en la máquina de build |
| PDF | pdfmake | JS puro, sin Chromium — boletas y reportes |
| Excel | ExcelJS | Formato, fórmulas, múltiples hojas |
| Empaquetado | Instalador Inno Setup: shell de escritorio autocontenido + Node portátil + código TS vía `tsx` | La interfaz sí se entrega como `.exe`; el servidor conserva Node oficial para mantener `node:sqlite`, ESM y actualizaciones seguras. Ver F6 en §10 |
| Arranque automático | `node-windows` (servicio de Windows), `execPath`/`nodeOptions` apuntando al Node portátil + `tsx` como loader | Sobrevive reinicios y cortes de luz — `node-windows` está diseñado para invocar `node.exe <script>`, no para envolver un `.exe` standalone, por eso no se combina con `@yao-pkg/pkg` |
| WhatsApp | `whatsapp-web.js` (sesión propia, sin costo por mensaje) | Decisión del cliente; riesgo de baneo mitigado. Ver §7 |
| Scanner | HID keyboard-wedge, listener con prefijo/sufijo | El scanner del all-in-one "teclea"; sin driver |
| Facturación electrónica | Cliente SOAP hecho a mano, directo contra SUNAT | Boleta/factura/notas de crédito y débito — sin OSE/PSE intermediario (decisión del cliente, ver §8) |

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
│  ├─ desktop/                # Tauri → HospedajeCarlos.exe (recepción / --kiosk)
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

## 8. Facturación electrónica SUNAT — decisión: en alcance, directo, sin OSE/PSE

Confirmado en alcance. `sales` sigue siendo dueño de la venta; `billing` es un
servicio aparte (`services/billing`) que la traduce a boleta/factura/nota de
crédito/nota de débito electrónica y la envía **directo a SUNAT** — decisión
explícita del cliente ("usaré el certificado gratuito de 3 años de SUNAT para
MYPEs y tú construyes toda la infraestructura"), no vía OSE/PSE. SUNAT ofrece
un certificado digital gratuito de 3 años específicamente para MYPEs (portal
SOL → Comprobantes de Pago → Certificado Digital Tributario).

- Emisión es **manual, no automática al `sale.paid`**: recepción elige, desde
  `RoomDetailDrawer.tsx`, si emite boleta o factura (con RUC) una vez la venta
  está pagada — el mismo patrón de "elegir después de cobrar" en vez de
  auto-emitir. Envío a SUNAT es **síncrono**: la respuesta ACEPTADO/RECHAZADO
  llega en la misma llamada, para que recepción sepa al toque si quedó bien.
- XML UBL 2.1 armado y firmado a mano (`domain/ubl.ts`, XMLDSig con
  `xml-crypto`, RSA-SHA1/SHA1 — SUNAT todavía lo exige pese a estar
  deprecado en todo lo demás), enviado por un cliente SOAP hecho a mano sobre
  `fetch` (`sunat/real-client.ts` — sin la librería `soap` de npm, la
  superficie real son 3 métodos). Guarda el **CDR** (Constancia de Recepción)
  que devuelve SUNAT.
- Si el envío falla (sin internet, SUNAT caído), el comprobante queda
  `ERROR`/`RECHAZADO` pero **el cuarto igual se entrega** — la operación del
  hotel nunca se bloquea por un problema de SUNAT. Reintentable a mano
  (`retrySubmission`) sin generar un correlativo nuevo.
- Además de boleta/factura: **Comunicación de Baja** (anular un comprobante
  ACEPTADO, solo facturas, ventana de 7 días) y **notas de crédito/débito**
  (corregir un comprobante ACEPTADO sin límite de 7 días — el mecanismo
  correcto pasada esa ventana). PDF de cortesía con QR también incluido — el
  documento legal sigue siendo el XML firmado + CDR, no el PDF.
- `SUNAT_MODE` en `.env` controla el modo: `MOCK` (sin red, default),
  `BETA` (ambiente de pruebas real de SUNAT), `PRODUCCION` (requiere el
  certificado MYPE real del cliente + usuario/clave SOL secundarios). Esa
  configuración es **editable en caliente** desde Ajustes → Facturación SUNAT
  (`apps/server/src/sunat-config.ts`): la pantalla reescribe las claves
  `SUNAT_*` de ese mismo `.env` y rehace el servicio de facturación en el
  acto, sin reiniciar el servicio de Windows. Si la configuración guardada no
  se puede usar al arrancar, el servidor levanta igual en `MOCK` y lo avisa —
  si se cayera, no habría pantalla donde corregirla.
- Serie y correlativo son propios de `billing` (`billing_correlativos`,
  incremento atómico vía `UPDATE...RETURNING`), no comparten numeración con
  `sales_ventas`.

---

## 9. Seguridad y datos personales

- Roles: `ADMIN`, `RECEPCIONISTA`, `KIOSCO` (token de dispositivo, sin persona).
- **El kiosco jamás recibe datos de cliente.** No es que la UI los oculte: el BFF del
  kiosco no los serializa. El cliente ve `OCUPADO`, nunca un nombre.
- **Nombres y DNI se guardan en texto plano hoy — no cifrados en reposo.**
  `better-sqlite3-multiple-ciphers` (la extensión que este documento
  proponía originalmente) dejó de aplicar cuando el proyecto cambió a
  `node:sqlite` (ver §3) — esa extensión no existe para el driver nativo
  de Node. Cifrado por columna es una decisión pendiente, no tomada: rompe
  cualquier búsqueda por nombre/DNI en cada servicio que los toca (`stays`,
  `sales`), así que necesita su propio diseño (hash buscable aparte, manejo
  de la llave) — no es un ajuste chico. **Mitigación recomendada mientras
  tanto: BitLocker** (cifrado de disco completo de Windows, ya disponible,
  cero código) — cubre el riesgo real de este despliegue (robo físico de la
  PC del hotel) sin la complejidad de cifrado a nivel de aplicación.
- Auditoría inmutable: modificar una venta o reserva siempre deja rastro de quién, qué
  y cuándo. Requisito directo de "permitir siempre modificar ventas y reservas".
- Respaldo automático diario del archivo `.db` a carpeta configurable (+ USB/nube) —
  ver `services/backup`, F6 en §10.

---

## 10. Roadmap por fases

| Fase | Alcance | Semanas |
|---|---|---|
| **F1 — Núcleo operable** | `identity`, `rooms`, `pricing`, `stays`, `sales`, `payments` (efectivo + Yape) + pantalla recepción, todo en vivo por WebSocket | 4 |
| **F2 — Kiosco** | SPA cliente, espejo en vivo, todos los métodos de pago, híbrido, QR y CCI | 2 |
| **F3 — Bodega y caja** | `inventory` con scanner, adicionales pre/post pago, `cashbox`, cuadre y turnos | 3 |
| **F4 — Inteligencia** | `reporting`, dashboard con comparativas, PDF/Excel, `notifications` WhatsApp (`whatsapp-web.js`) | 3 |
| **F5 — Facturación electrónica** | Servicio `billing`, directo a SUNAT (sin OSE), CDR, notas de crédito/débito | 2 |
| **F6 — Endurecimiento** | Respaldos, servicio de Windows, instalador, capacitación | 1 |

F1 ya es un sistema que reemplaza el cuaderno.
