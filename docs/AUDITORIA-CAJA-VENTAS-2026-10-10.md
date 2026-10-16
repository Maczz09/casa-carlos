# Auditoría y corrección de caja, ventas y horas extra

Fecha: 10 de octubre de 2026. Versión del instalador: 1.3.0.

## Alcance y evidencia

Se revisaron los servicios de estadías, ventas, pagos, caja, inventario y reportes, sus rutas HTTP, las pantallas de recepción y los tickets. La base local se consultó en modo de solo lectura. No se ejecutó el servicio sobre los datos del hotel ni se instaló la actualización.

En la base consultada había una estadía finalizada cuya venta seguía como PAGADA. Esto confirmó el cierre incompleto: checkout finalizaba la estadía sin cerrar la venta. La migración se verificó sobre una copia íntegra en memoria: reparó ese cierre, conservó todos los pagos, detalles, movimientos, turnos e importes, y SQLite devolvió `integrity_check: ok`.

## Hallazgos corregidos

| Problema | Causa | Corrección |
| --- | --- | --- |
| Pago de horas registrado pero checkout bloqueado | El cargo manual compartía referencia con el automático; la cuenta se recalculaba al reloj actual durante el cobro y el cierre | Referencias independientes, ampliación del horario al agregar horas, un corte de salida persistente antes de cobrar y cierre desde ese corte |
| Venta no aparecía como cerrada tras checkout | Se cerraba únicamente la estadía | Estadía y venta se cierran juntas; la venta conserva fecha, líneas, pagos y auditoría |
| Cobro posterior al cierre confundido con la caja anterior | El reporte reunía todos los pagos de la venta | Cada turno muestra solamente sus cobros y sus responsables; el historial relaciona todos los turnos |
| Eliminación borraba movimientos originales | La anulación eliminaba los movimientos de la venta | Se conserva el cobro y se crea un movimiento ANULACION en la caja abierta del anulador, por método y con motivo |
| Vuelto descontado dos veces | VENTA guardaba el monto aplicado y VUELTO volvía a reducirlo | VENTA aporta el importe neto; VUELTO conserva el detalle informativo |
| Venta, pago y caja podían quedar parcialmente actualizados | Los errores de eventos contables se ocultaban | Transacción compartida, errores críticos propagados y lecturas externas en espera hasta confirmar o revertir |
| Consulta histórica podía alterar cargos | Leer una venta recalculaba incluso ventas finalizadas | Historial sin escrituras y cálculo detenido en ventas cerradas/estadías finalizadas |
| Venta antigua con un cobro reciente no aparecía en el rango | Filtro solo por creación y fechas UTC | Se incluyen cobros, correcciones y cierres del período, con límites diarios de Lima |

## Flujo de horas extra y salida

1. Agregar horas crea un cargo manual y amplía la salida prevista. El exceso automático cubierto por la ampliación se ajusta; no se cobra ese mismo tiempo dos veces. Se cobra el saldo actualizado mediante el formulario que registra métodos, efectivo recibido, vuelto y códigos de operación.
2. Checkout está disponible también si existe saldo. Elegir la hora y revisar muestra el total, los cambios de cargos, el saldo por cobrar y cualquier devolución.
3. Confirmar registra la hora real de salida antes de abrir el cobro. El tiempo dedicado al trámite no genera más horas. Al aceptar el pago, la interfaz completa checkout.
4. Si la salida fue anterior, se ofrece anular las horas extra cargadas. Alternativamente, se recalcula el exceso automático hasta esa hora y se conservan las horas manuales. La reducción exige motivo y confirmación explícita.
5. Si se reducen cargos ya pagados, se muestra la devolución por los métodos originales. Su confirmación requiere caja abierta y crea DEVOLUCION con usuario, fecha y motivo. Se resta del efectivo físico únicamente si el método es efectivo.
6. Una reducción sin devolución también deja un movimiento CORRECCION de importe cero en la caja abierta, para que la operación aparezca en su reporte. La auditoría registra siempre el cambio completo.
7. Si la cuenta cambió mientras se revisaba, la confirmación se rechaza y requiere actualizar la revisión. Un pago pendiente puede aceptarse o rechazarse con motivo antes de continuar. Si la corrección elimina todo su saldo, el intento pendiente queda rechazado con motivo y usuario, y permite cerrar.

## Historial y reporte detallado

Desde Ventas y el reporte de caja se puede abrir el historial completo: cargos vigentes y anulados, pagos, métodos, montos aplicados, efectivo recibido, vuelto, operador, turnos y operaciones con fecha, motivo y valores antes/después.

El reporte diferencia el total completo de la venta de lo cobrado, anulado y devuelto en ese turno. Conserva los cargos anulados en el detalle. El ticket impreso incluye movimientos y responsables. Los movimientos y el cierre de una caja anterior no se eliminan ni se trasladan por una anulación posterior.

Los comprobantes ya emitidos mantienen su contenido original; el historial de venta y el reporte muestran las correcciones posteriores.

## Validación

- 19 pruebas de integración aprobadas con SQLite en memoria y rutas HTTP: cajas de distintos usuarios, dos cuartos con exceso después de cerrar caja, checkout tras pago de horas manuales y automáticas, corte previo al cobro, salida anterior, devoluciones por efectivo y billetera, motivo obligatorio, revisión concurrente, pago parcial/rechazado, rollback y devolución de stock.
- Verificación de tipos de todos los paquetes del workspace.
- Migraciones desde una copia en memoria de la base local: importes y registros de dinero sin cambios; reparación de un cierre histórico; integridad SQLite correcta.
- Compilación de recepción, kiosco, aplicación de escritorio y empaquetado del instalador.

Para repetir las pruebas: `corepack pnpm --filter @casacarlos/server run test:finance`. Para tipos: `corepack pnpm -r run typecheck`. Para el instalador: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-installer.ps1`.

## Límites de la reparación histórica

La actualización cierra ventas de estadías ya finalizadas únicamente si tienen saldo cero. No inventa cobros ni reconstruye movimientos que versiones anteriores hayan eliminado. Las operaciones conservadas pueden consultarse en el historial; los casos sin datos suficientes requieren conciliación con los comprobantes o respaldos disponibles.
