# Caja compartida, relevos y botones · 1.5.0

## Problemas y correcciones

El turno abierto se consultaba por `usuario_id`. Al cambiar de recepcionista se recuperaba una caja distinta, y los cobros exigían una apertura propia. La caja activa del hotel ahora se resuelve mediante una referencia única en `cashbox_configuracion`. Las aperturas se serializan dentro de transacciones: dos solicitudes simultáneas no generan dos cajas activas. Cualquier recepcionista autorizado usa el mismo turno; cada movimiento conserva al usuario real que lo gestionó.

La captura aportada mostraba dos botones con `w-full` y `shrink-0` dentro de una fila: cada botón ocupaba el ancho completo. Playwright reprodujo el desborde a 1366 y 1024 px. El diálogo ahora usa columnas que respetan el ancho disponible y los botones permiten encoger y envolver su texto. Se corrigió también el botón de continuación: lleva al conteo de cierre, por lo que se llama «Continuar al conteo de cierre».

## Operación

- En **Caja → Caja compartida** se consulta el turno activo, el fondo y el siguiente relevo. Cerrar sesión no cierra ni cambia esa caja.
- **Caja → Turnos y Horarios** permite activar o desactivar los relevos. «Aplicar 3 turnos automáticos» configura 09:00–17:00, 17:00–01:00 y 01:00–09:00, en `America/Lima`, de forma atómica. Los horarios anteriores permanecen disponibles para reportes; el preset reemplaza los horarios activos y no los duplica.
- Los horarios deben cubrir 24 horas sin solaparse. Si están incompletos o se superponen, la pantalla informa el problema y la automatización queda en pausa hasta corregirlos. La caja sigue siendo compartida.
- La primera apertura requiere declarar el fondo físico. A partir de ella, cada límite cierra el tramo anterior y abre el siguiente con su fondo esperado. El servidor comprueba límites cada 15 segundos y también antes de registrar cobros y otras operaciones. Después de un reinicio recupera los límites pendientes con sus horas originales.
- El relevo registra `TRASPASO_SALIDA` y la apertura vinculada al turno anterior. El fondo heredado no se considera una venta y no se duplica en el saldo acumulado. Los faltantes contables conservan su signo.
- Un relevo automático se identifica con el actor **Sistema automático**, su motivo, fecha y auditoría. El efectivo declarado, las denominaciones y la diferencia permanecen sin declarar: el sistema no inventa un arqueo físico. El personal puede registrar un arqueo para verificar el cajón.
- Un cierre manual conserva el conteo y al usuario que cerró. Después de cerrar manualmente, una nueva apertura requiere declarar el fondo; la automatización no reabre inmediatamente una caja cerrada a mano.
- Las habitaciones permanecen abiertas entre turnos. Cada nuevo cobro entra en la caja activa y los cobros previos permanecen en su turno original.

## Instalaciones con varias cajas abiertas anteriores

La migración 0019 añade metadatos y selecciona el turno abierto más reciente como referencia inicial compartida. **No cierra, fusiona, borra ni cambia importes o movimientos de los turnos existentes.**

Las otras cajas abiertas aparecen como **turnos anteriores pendientes de conciliar**. No reciben nuevos cobros. Su detalle y sus movimientos siguen accesibles; para cerrarlas se declara el conteo comprobado y un sustento obligatorio, atribuido al usuario autenticado. Esa conciliación no modifica el dinero de la caja activa. Si corresponde incorporar dinero físico, se registra mediante un ingreso o ajuste explícito con su motivo. El resumen por periodo conserva los movimientos históricos de esos turnos; no equivale a contar el dinero actual del cajón.

## Sincronización

El servidor envía invalidaciones por WebSocket después del commit de aperturas, cierres, cobros, devoluciones, anulaciones, arqueos y cambios de configuración. Cada sesión autorizada consulta de nuevo la misma caja. La interfaz agrupa eventos, evita aplicar respuestas antiguas y se actualiza también al recuperar el foco y cada 15 segundos. Si cambia el turno durante un formulario, se descarta el conteo asociado al turno anterior y se informa al operador.

## Verificación reproducible

- `node --import ./apps/server/node_modules/tsx/dist/loader.mjs --test apps/server/tests/finance.test.ts apps/server/tests/cashbox-shifts.test.ts`: **30 pruebas aprobadas**, con bases en memoria. Incluye concurrencia, usuarios distintos, cobro en el límite, medianoche, reinicio, conservación de fondos, reversión completa de fallos y migración sin alterar datos existentes.
- `node --import ./apps/server/node_modules/tsx/dist/loader.mjs apps/server/tests/cashbox-ui.mts`: Playwright usa un servidor local y una base en memoria, WebSockets reales y dos sesiones independientes. Comprueba botones a 1366×768, 1024×768 y 390×844; cambios visibles sin recargar, relevo automático, cierre, reapertura y cerrar sesión/ingresar con otro recepcionista.
- Evidencia regenerable en `.cache/cashbox-ui`: resultados, capturas antes/después y trazas `after-session-0.zip` y `after-session-1.zip`, que se pueden reproducir con Playwright Trace Viewer. Las credenciales y todos los registros de estas pruebas son sintéticos.
- `node scripts/ui-smoke.mjs` comprueba el resto de módulos, los diálogos y los temas; sus resultados se guardan en `.cache/ui-smoke`.

El instalador Windows 1.5.0 se genera en `installer/output/HospedajeCarlos-Setup.exe`, con un archivo SHA-256 adyacente. Las verificaciones no instalan ni modifican la base de producción del hotel.
