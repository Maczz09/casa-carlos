# Casa Carlos — Catálogo de casos de uso

134 casos de uso derivados de la toma de requerimientos.
Actores: **ADM** administrador · **REC** recepcionista · **CLI** cliente (kiosco) · **SIS** sistema (automático).

---

## AUT — Identidad y acceso · `identity`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| AUT-01 | Iniciar sesión con usuario y contraseña | ADM, REC | Sesión ligada al turno abierto |
| AUT-02 | Cambio rápido de recepcionista por PIN | REC | Sin cerrar la app; queda registrado en cada venta |
| AUT-03 | Crear, editar y desactivar usuarios | ADM | Nunca se borra: se desactiva (histórico intacto) |
| AUT-04 | Emparejar dispositivo kiosco | ADM | Token de dispositivo, sin login humano |
| AUT-05 | Restablecer contraseña de recepcionista | ADM | — |
| AUT-06 | Cerrar sesión / expiración por inactividad | SIS | Timeout configurable |
| AUT-07 | Consultar bitácora de accesos | ADM | — |

## CUA — Cuartos y pisos · `rooms`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| CUA-01 | Registrar pisos | ADM | 2.º piso: 4 cuartos · 3.º piso: 5 cuartos |
| CUA-02 | Registrar cuarto (número, piso, categoría, descripción, qué incluye) | ADM | ID único visible |
| CUA-03 | Definir categorías y atributos | ADM | Matrimonial, doble · con/sin ventilador (combinables) |
| CUA-04 | Editar o desactivar un cuarto | ADM | — |
| CUA-05 | Ver tablero de cuartos en vivo — vista interna | ADM, REC | Incluye nombre del cliente, hora de inicio y de salida |
| CUA-06 | Ver tablero de cuartos — vista cliente | CLI | Solo DISPONIBLE / OCUPADO. **Sin datos personales** |
| CUA-07 | Semáforo de piso | Todos | Verde si ≥1 disponible · Rojo si 0 disponibles |
| CUA-08 | Marcar cuarto en limpieza | REC | Manual, tras liberarse. Duración 5 min |
| CUA-09 | Liberar cuarto al terminar limpieza | SIS | Automático a los 5 min → DISPONIBLE |
| CUA-10 | Extender o cortar la limpieza | REC | — |
| CUA-11 | Marcar fuera de servicio / reactivar | ADM, REC | Con motivo; no aparece como disponible |
| CUA-12 | Ver hora proyectada de desocupación | ADM, REC, CLI | Requisito explícito para ambas vistas |
| CUA-13 | Consultar historial de ocupación de un cuarto | ADM | — |

## TAR — Tarifas · `pricing`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| TAR-01 | Crear temporada tarifaria | ADM | Nombre + vigencia; permite alta/baja temporada |
| TAR-02 | Definir N franjas horarias de la temporada | ADM | **N variable**: 3, 4, las que necesite |
| TAR-03 | Asignar precio por franja × categoría × modalidad | ADM | Matriz completa |
| TAR-04 | Editar franjas y precios | ADM | Versionado; no altera ventas ya emitidas |
| TAR-05 | Definir escala por número de noches | ADM | 1, 2, 3… N noches → monto total creciente |
| TAR-06 | Configurar cargo por check-in anticipado | ADM | Por hora o fracción adelantada |
| TAR-07 | Configurar tolerancia y política de exceso | ADM | Por defecto 15 min |
| TAR-08 | Configurar precio del bloque de extensión | ADM | Bloque adicional de 3 h |
| TAR-09 | Resolver tarifa vigente ahora | SIS | Motor de resolución, ver reglas §2 |
| TAR-10 | Simular tarifa para fecha/hora futura | REC, ADM | Necesario para reservas y cotizaciones |
| TAR-11 | Activar/desactivar temporada y resolver solapamientos | ADM | Gana la de mayor prioridad |
| TAR-12 | Consultar histórico de cambios de tarifa | ADM | Quién, qué y cuándo |

## MOD — Modalidades de servicio · `pricing` + `stays`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| MOD-01 | Modalidad **por horas** | — | Bloques de 3 h |
| MOD-02 | Modalidad **noche A** | — | Check-in 14:00 → check-out 10:00 (20 h) |
| MOD-03 | Modalidad **noche B** | — | Check-in 20:00 → check-out 08:00 (12 h) |
| MOD-04 | Modalidad **multi-noche** | — | Escala creciente por cantidad de noches |
| MOD-05 | Crear o editar modalidades | ADM | Duración, horas fijas, tolerancia propia |

## RES — Reservas y estadías · `stays`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| RES-01 | Seleccionar modalidad antes de abrir la venta | REC | **Primer paso obligatorio** del flujo |
| RES-02 | Crear reserva con fecha, hora, cuarto y cliente | REC | Nombres, apellidos y DNI |
| RES-03 | Bloquear el cuarto por reserva de noche | SIS | Ocupa el día completo hasta el check-out |
| RES-04 | Rechazar reserva que se solape con un bloqueo | SIS | Validación dura |
| RES-05 | Hacer check-in de una reserva | REC | Pasa a OCUPADO, arranca el contador |
| RES-06 | Check-in anticipado con cargo | REC | Ej.: llega 07:00 para ventana 14:00 → cobro adicional |
| RES-07 | Venta directa sin reserva (walk-in) | REC | — |
| RES-08 | Ver contador en vivo de tiempo restante | ADM, REC | Por cada estadía activa |
| RES-09 | Entrar en tolerancia | SIS | A la hora límite → estado EN_TOLERANCIA + alerta en pantalla |
| RES-10 | Superar la tolerancia | SIS | +15 min → EXCEDIDO + **WhatsApp a admin y recepcionista** |
| RES-11 | Fijar el monto del cargo por exceso | REC | El recepcionista decide; el sistema sugiere |
| RES-12 | Extender estadía por horas | REC | Bloque de +3 h, antes o después del vencimiento |
| RES-13 | Agregar noche adicional a estadía en curso | REC | Recalcula con la escala de noches |
| RES-14 | Hacer check-out | REC | Exige saldo en cero → dispara limpieza |
| RES-15 | Modificar reserva o estadía | REC, ADM | Cuarto, modalidad, horario, cliente. **Siempre permitido**, siempre auditado |
| RES-16 | Anular reserva | REC, ADM | Con motivo. **Sin reembolso** |
| RES-17 | Marcar no-show y liberar el cuarto | REC | Pasado el margen configurado |
| RES-18 | Ver datos del cliente de una reserva | ADM, REC | Nunca visible para CLI |
| RES-19 | Ver agenda del día por piso | ADM, REC | — |
| RES-20 | Ver hora de desocupación en vista cliente | CLI | Sin nombre, solo la hora |

## BOD — Bodega · `inventory`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| BOD-01 | Dar de alta un producto escaneando el código de barras | ADM | Scanner del all-in-one (HID) |
| BOD-02 | Editar producto (nombre, precio, categoría, stock mínimo) | ADM | — |
| BOD-03 | Registrar ingreso de stock por compra | ADM | Con escaneo |
| BOD-04 | Ajustar stock por merma o corrección | ADM | Motivo obligatorio |
| BOD-05 | Gestionar estados del producto | ADM | Activo · Agotado · Descontinuado |
| BOD-06 | Alertar stock bajo | SIS | Al cruzar el mínimo |
| BOD-07 | Despachar producto a un cuarto | REC | Por escaneo o búsqueda; descuenta stock |
| BOD-08 | Agregar producto como adicional **antes** del pago | REC, CLI | Entra al total de la venta |
| BOD-09 | Agregar producto como adicional **después** del pago | REC | Ej.: lo pide a la hora y media → genera saldo pendiente |
| BOD-10 | Anular una línea de consumo | REC | Devuelve stock; auditado |
| BOD-11 | Consultar kardex de un producto | ADM | Todos los movimientos |
| BOD-12 | Reporte de consumo por cuarto, turno o período | ADM | — |

## VEN — Ventas y cotizaciones · `sales`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| VEN-01 | Abrir venta eligiendo tipo y modalidad | REC | Reserva · por horas · noche A · noche B |
| VEN-02 | Generar cotización | REC | **No** compromete cuarto; tiene vigencia |
| VEN-03 | Convertir cotización en venta | REC | Recalcula tarifa al momento real |
| VEN-04 | Agregar la línea de hospedaje | SIS | Precio congelado desde `pricing` |
| VEN-05 | Agregar líneas de producto | REC, CLI | — |
| VEN-06 | Agregar cargos extra | REC | Check-in anticipado, exceso, extensión |
| VEN-07 | Ver total acumulado en vivo | REC, CLI | Se actualiza en ambas pantallas a la vez |
| VEN-08 | Registrar datos del cliente | REC | Nombres completos y DNI |
| VEN-09 | Cerrar la venta al confirmarse el pago | SIS | — |
| VEN-10 | Reabrir venta pagada para adicionales | REC | Marca las líneas como POST_PAGO |
| VEN-11 | Liquidar el saldo pendiente en el check-out | REC | Bloquea el check-out si hay saldo |
| VEN-12 | Anular una venta | ADM | Motivo obligatorio, auditado |
| VEN-13 | Emitir boleta en PDF | REC | Nombres, DNI, cuarto, hospedaje, productos, cargos, pagos |
| VEN-14 | Reimprimir o reenviar boleta | REC | — |
| VEN-15 | Numeración correlativa por serie | SIS | Sin huecos |
| VEN-16 | Consultar ventas del turno y del día | ADM, REC | **Todos los recepcionistas ven todo** |

## PAG — Pagos · `payments`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| PAG-01 | Seleccionar método de pago | CLI | Desde el kiosco |
| PAG-02 | Pago híbrido con 2+ métodos | CLI, REC | La suma de montos debe igualar el total |
| PAG-03 | Pago en efectivo | CLI, REC | Kiosco muestra el monto; REC confirma recepción |
| PAG-04 | Pago Yape | CLI, REC | Kiosco muestra QR; REC ingresa **código de 3 dígitos** |
| PAG-05 | Pago Plin | CLI, REC | Kiosco muestra QR; REC ingresa código de operación |
| PAG-06 | Pago Lemon / Agora | CLI, REC | QR o datos; REC ingresa referencia |
| PAG-07 | Transferencia bancaria | CLI, REC | Kiosco muestra banco, **cuenta y CCI**; REC ingresa ID de operación + nombres y apellidos del ordenante |
| PAG-08 | Pago con POS (crédito/débito) | REC | REC ingresa número de operación del voucher |
| PAG-09 | Aceptar o rechazar el pago | REC | **Decisión del recepcionista**, siempre |
| PAG-10 | Registrar vuelto en efectivo | REC | Afecta el cuadre de caja |
| PAG-11 | Cobrar el saldo POST_PAGO | REC | Mismos métodos disponibles |
| PAG-12 | Administrar cuentas de cobro | ADM | Bancos, número de cuenta, CCI, titular, imágenes QR |
| PAG-13 | Consultar los comprobantes de una venta | ADM, REC | Códigos, montos y método de cada detalle |
| PAG-14 | Corregir un detalle de pago mal registrado | REC, ADM | Auditado |

## CAJ — Caja y turnos · `cashbox`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| CAJ-01 | Configurar plantillas de turno | ADM | **2 o 3 turnos**, con hora de inicio y fin |
| CAJ-02 | Asignar recepcionista a cada turno | ADM | Calendario |
| CAJ-03 | Abrir turno con monto inicial | REC | — |
| CAJ-04 | Registrar ingreso o egreso manual de caja | REC | Motivo obligatorio |
| CAJ-05 | Cerrar turno declarando el efectivo contado | REC | — |
| CAJ-06 | Cuadre por método de pago | SIS | Esperado vs. declarado; diferencia |
| CAJ-07 | Bloquear cierre con diferencia sobre el umbral | SIS | Exige justificación |
| CAJ-08 | Arqueo diario, semanal y mensual | ADM | Además del cuadre por turno |
| CAJ-09 | Filtrar por rango: de tal mes a tal mes, año a año | ADM | — |
| CAJ-10 | Exportar cuadre a PDF y Excel | ADM, REC | — |
| CAJ-11 | Reporte de boletas del período | ADM | Nombres, DNI, cuarto, productos |
| CAJ-12 | Consultar histórico de turnos y quién los operó | ADM | — |
| CAJ-13 | Traspasar caja al turno siguiente | REC | El cierre de uno es la apertura del otro |

## DAS — Dashboard y reportes · `reporting`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| DAS-01 | Ventas totales por día, semana, mes y año | ADM | — |
| DAS-02 | Comparativa periodo actual vs. anterior | ADM | Semana vs. semana previa, mes, año |
| DAS-03 | Cuartos alquilados por día | ADM | — |
| DAS-04 | Ocupación % por piso y por categoría | ADM | — |
| DAS-05 | Ingresos por modalidad | ADM | Horas vs. noche A vs. noche B |
| DAS-06 | Ventas por recepcionista | ADM | Día, semana, mes, año y acumulado del período en curso |
| DAS-07 | Comparativa entre recepcionistas | ADM | Requisito explícito |
| DAS-08 | Ticket promedio y consumo de bodega por venta | ADM | — |
| DAS-09 | Ranking de productos vendidos | ADM | — |
| DAS-10 | Ingresos por método de pago | ADM | — |
| DAS-11 | Ingresos por cargos de exceso y check-in anticipado | ADM | Mide cuánto aporta la política de tolerancia |
| DAS-12 | Exportar cualquier panel a PDF o Excel | ADM | — |
| DAS-13 | Horas pico de ocupación | ADM | Mapa de calor hora × día → sustenta las franjas tarifarias |

## NOT — Notificaciones · `notifications`

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| NOT-01 | Configurar números de WhatsApp | ADM | Admin y cada recepcionista |
| NOT-02 | Enviar alerta de exceso de tiempo | SIS | Cuarto, piso, cliente, DNI, modalidad, hora de inicio, hora límite, minutos excedidos, consumo pendiente, monto sugerido |
| NOT-03 | Avisar check-out próximo | SIS | X minutos antes, configurable |
| NOT-04 | Avisar stock bajo | SIS | — |
| NOT-05 | Avisar cierre de turno con diferencia | SIS | Al admin |
| NOT-06 | Reintentar envíos fallidos | SIS | Cola persistente; la alerta en pantalla nunca depende de internet |
| NOT-07 | Consultar bitácora de notificaciones | ADM | Enviadas, fallidas, pendientes |
| NOT-08 | Editar plantillas de mensaje | ADM | — |

## KIO — Pantalla del cliente · `gateway` + kiosco

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| KIO-01 | Mostrar pantalla en espera | SIS | Hasta que recepción abra una venta |
| KIO-02 | Seleccionar piso | CLI | Con semáforo verde/rojo |
| KIO-03 | Ver los cuartos del piso | CLI | Estado, categoría, descripción, qué incluye, precio vigente |
| KIO-04 | Seleccionar cuarto | CLI | Solo disponibles |
| KIO-05 | Agregar productos desde el panel lateral | CLI | **Opcional** |
| KIO-06 | Ver el total acumulándose en vivo | CLI | Requisito explícito |
| KIO-07 | Avanzar a la selección de pago | CLI | Botón siguiente |
| KIO-08 | Ver datos bancarios para transferencia | CLI | Banco, número de cuenta y CCI del titular |
| KIO-09 | Ver el QR de billetera digital | CLI | Yape, Plin, Lemon, Agora |
| KIO-10 | Ver el monto a pagar en efectivo | CLI | Paga en mano al recepcionista |
| KIO-11 | Armar un pago híbrido | CLI | Reparte el total entre métodos; valida la suma |
| KIO-12 | Esperar la confirmación del recepcionista | CLI | Pantalla de espera |
| KIO-13 | Ver el resultado | CLI | Aceptado (cuarto e instrucciones) o rechazado |
| KIO-14 | No exponer nunca datos de otros clientes | SIS | El BFF del kiosco no serializa nombres ni DNI |
| KIO-15 | Volver a espera por inactividad | SIS | Timeout configurable |

## REC — Pantalla de recepción · `gateway` + recepción

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| REC-01 | Abrir venta y elegir modalidad → carga el kiosco | REC | Dispara el flujo del cliente |
| REC-02 | Ver en vivo lo que hace el cliente | REC | Espejo por WebSocket |
| REC-03 | Tomar el control y ejecutar el flujo por el cliente | REC | Requisito explícito |
| REC-04 | Registrar nombres y DNI del cliente | REC | — |
| REC-05 | Validar y aceptar o rechazar el pago | REC | — |
| REC-06 | Ingresar los códigos de cada método | REC | 3 dígitos Yape · operación Plin · ID transferencia + nombre · voucher POS |
| REC-07 | Registrar los montos de cada método en pago híbrido | REC | — |
| REC-08 | Entregar el cuarto e imprimir boleta | REC | Check-in |
| REC-09 | Ver el tablero de cuartos con contadores | REC | Tiempo restante por estadía |
| REC-10 | Marcar limpieza y liberar cuarto | REC | — |
| REC-11 | Agregar productos a un cuarto ocupado | REC | Pre o post pago según corresponda |
| REC-12 | Aplicar y cobrar el cargo por exceso | REC | Él fija el monto |
| REC-13 | Modificar una venta o reserva existente | REC | — |
| REC-14 | Generar una cotización | REC | — |
| REC-15 | Abrir y cerrar su turno de caja | REC | — |
| REC-16 | Ver ventas y reservas de todos los recepcionistas | REC | Lectura completa |

## ADM — Administración · varios

| ID | Caso de uso | Actor | Regla clave |
|---|---|---|---|
| ADM-01 | Configurar datos del hospedaje | ADM | Nombre, RUC, dirección, logo, serie de boletas |
| ADM-02 | Configurar tolerancias y duración de limpieza | ADM | 15 min y 5 min por defecto |
| ADM-03 | Ver auditoría completa | ADM | Quién modificó qué venta, reserva o tarifa y cuándo |
| ADM-04 | Respaldar y restaurar la base de datos | ADM | Automático diario + manual |
| ADM-05 | Configurar parámetros del sistema | ADM | Puerto, impresora, moneda, zona horaria |
| ADM-06 | Ver el nombre del cliente en cuartos reservados y ocupados | ADM | **Solo admin y recepción** |
