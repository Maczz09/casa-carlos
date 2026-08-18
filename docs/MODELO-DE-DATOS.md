# Hospedaje Carlos — Modelo de datos

SQLite en modo WAL. Un archivo: `casacarlos.db`.
Cada tabla lleva el **prefijo de su servicio**; un servicio solo escribe en sus tablas.
Sin `JOIN` entre prefijos distintos: los datos ajenos se leen por puerto o por
proyección alimentada por eventos.

Convenciones: `id` = ULID (texto, ordenable por tiempo) · timestamps ISO-8601 UTC ·
**montos en enteros de céntimos** · borrado lógico con `activo`, nunca `DELETE`.

---

## identity

```sql
identity_usuarios(
  id, usuario UNIQUE, nombres, apellidos, dni,
  password_hash, pin_hash, rol,            -- ADMIN | RECEPCIONISTA
  telefono_whatsapp, activo, creado_en )

identity_sesiones(
  id, usuario_id, turno_id, token_hash,
  iniciada_en, expira_en, ip, cerrada_en )

identity_dispositivos(                      -- kioscos
  id, nombre, token_hash, ubicacion, activo, ultimo_visto_en )
```

## rooms

```sql
rooms_pisos(
  id, numero, nombre, orden, activo )       -- 2.º piso, 3.º piso

rooms_categorias(
  id, nombre, descripcion, activo )         -- Matrimonial, Doble…

rooms_atributos(
  id, nombre )                              -- con ventilador, sin ventilador, TV…

rooms_categoria_atributos( categoria_id, atributo_id )

rooms_cuartos(
  id, numero UNIQUE, piso_id, categoria_id,
  descripcion, incluye,                     -- texto libre mostrado al cliente
  fuera_de_servicio, motivo_fuera_servicio,
  limpieza_hasta,                           -- timestamp; NULL si no está en limpieza
  activo, creado_en )

rooms_historial_estado(
  id, cuarto_id, estado_anterior, estado_nuevo,
  estadia_id, usuario_id, ocurrido_en )
```

> `rooms_cuartos` **no** guarda un campo `estado`. El estado se deriva de
> `fuera_de_servicio` + `limpieza_hasta` + la estadía activa (proyección `stays`).

## pricing

```sql
pricing_temporadas(
  id, nombre, desde, hasta, prioridad, activa )

pricing_franjas(
  id, temporada_id, hora_inicio, orden, etiqueta )   -- N variable por temporada

pricing_modalidades(
  id, codigo, nombre,                        -- HORAS_3 | NOCHE_A | NOCHE_B
  duracion_horas, checkin_fijo, checkout_fijo,
  tolerancia_min, activa )

pricing_tarifas(
  id, franja_id, categoria_id, modalidad_id,
  precio_centimos, vigente_desde, vigente_hasta )     -- versionado

pricing_escala_noches(
  id, modalidad_id, categoria_id, noches, precio_total_centimos )

pricing_cargos(
  id, codigo,                                -- EARLY_CHECKIN | EXCESO | EXTENSION_3H
  nombre, precio_centimos, unidad, activo )  -- unidad: HORA | BLOQUE | FIJO
```

## stays

```sql
stays_clientes(
  id, nombres, apellidos, dni UNIQUE,        -- cifrados en reposo
  telefono, creado_en )

stays_estadias(
  id, cuarto_id, cliente_id, modalidad_id, venta_id,
  tipo,                                      -- RESERVA | DIRECTA
  estado,                                    -- RESERVADA | EN_CURSO | EN_TOLERANCIA
                                             -- | EXCEDIDA | FINALIZADA | ANULADA
  reservada_para, bloqueo_desde, bloqueo_hasta,
  checkin_previsto, checkin_real,
  checkout_previsto, checkout_real,
  noches, bloques_horas,
  tolerancia_min, notificado_exceso_en,
  motivo_anulacion, turno_id, usuario_id, creado_en )

stays_extensiones(
  id, estadia_id, tipo,                      -- BLOQUE_3H | NOCHE_EXTRA
  cantidad, nuevo_checkout, precio_centimos,
  usuario_id, creado_en )
```

## inventory

```sql
inventory_productos(
  id, codigo_barras UNIQUE, nombre, descripcion,
  categoria, precio_centimos, costo_centimos,
  stock, stock_minimo,
  estado,                                    -- ACTIVO | AGOTADO | DESCONTINUADO
  activo, creado_en )

inventory_movimientos(                       -- kardex, solo-append
  id, producto_id, tipo,                     -- INGRESO | SALIDA | AJUSTE | ANULACION
  cantidad, stock_resultante,
  cuarto_id, estadia_id, venta_id, linea_venta_id,
  motivo, usuario_id, turno_id, ocurrido_en )
```

## sales

```sql
sales_ventas(
  id, serie, correlativo,                    -- UNIQUE(serie, correlativo)
  tipo,                                      -- COTIZACION | VENTA
  estado,                                    -- BORRADOR | ABIERTA | PAGADA
                                             -- | CON_SALDO | CERRADA | ANULADA
  estadia_id, cuarto_id, cliente_id,
  cliente_nombres, cliente_apellidos, cliente_dni,   -- snapshot en la boleta
  total_centimos, pagado_centimos, saldo_centimos,
  vigencia_hasta,                            -- solo cotizaciones
  turno_id, usuario_id,
  pagada_en, cerrada_en, motivo_anulacion, creado_en )

sales_lineas(
  id, venta_id, tipo,                        -- HOSPEDAJE | PRODUCTO | CARGO_EXTRA
  referencia_id,                             -- producto_id | cargo_id | modalidad_id
  descripcion, cantidad,
  precio_unitario_centimos, subtotal_centimos,
  fase,                                      -- PRE_PAGO | POST_PAGO
  anulada, motivo_anulacion,
  usuario_id, creado_en )

sales_boletas(
  id, venta_id, ruta_pdf, emitida_en, reimpresiones )
```

## payments

```sql
payments_cuentas_cobro(
  id, tipo,                                  -- BANCO | BILLETERA
  proveedor,                                 -- BCP | Interbank | YAPE | PLIN | LEMON | AGORA
  titular, numero_cuenta, cci,
  qr_imagen,                                 -- BLOB o ruta
  orden, activa )

payments_pagos(
  id, venta_id, total_centimos,
  estado,                                    -- PENDIENTE | ACEPTADO | RECHAZADO
  motivo_rechazo, aceptado_por, aceptado_en,
  turno_id, creado_en )

payments_detalles(
  id, pago_id, metodo,                       -- EFECTIVO | YAPE | PLIN | LEMON | AGORA
                                             -- | TRANSFERENCIA | POS_CREDITO | POS_DEBITO
  monto_centimos,
  codigo_operacion,                          -- 3 dígitos Yape · operación Plin · ID transf.
  ordenante_nombres, ordenante_apellidos,    -- transferencias
  banco_origen, cuenta_cobro_id,
  recibido_centimos, vuelto_centimos,        -- efectivo
  creado_en )
```

> Regla verificada en aplicación y por trigger: `Σ payments_detalles.monto_centimos`
> de un pago debe igualar `payments_pagos.total_centimos`.

## cashbox

```sql
cashbox_plantillas_turno(
  id, nombre, hora_inicio, hora_fin, orden, activa )   -- 2 o 3 al día

cashbox_asignaciones(
  id, plantilla_id, usuario_id, fecha )

cashbox_turnos(
  id, plantilla_id, usuario_id, fecha,
  abierto_en, cerrado_en,
  apertura_centimos,
  efectivo_esperado_centimos, efectivo_declarado_centimos,
  diferencia_centimos, justificacion,
  estado )                                   -- ABIERTO | CERRADO

cashbox_movimientos(
  id, turno_id, tipo,                        -- APERTURA | VENTA | INGRESO | EGRESO
                                             -- | VUELTO | CIERRE
  metodo, monto_centimos, venta_id, pago_id,
  motivo, usuario_id, ocurrido_en )
```

## reporting

Solo tablas de proyección, reconstruibles desde los eventos. Se recalculan en un
`rebuild` si algo se corrompe.

```sql
reporting_ventas_diarias(
  fecha, usuario_id, modalidad_id, categoria_id,
  cantidad, total_centimos, PRIMARY KEY(fecha, usuario_id, modalidad_id, categoria_id) )

reporting_ocupacion_diaria(
  fecha, piso_id, cuarto_id, minutos_ocupado, alquileres )

reporting_pagos_por_metodo( fecha, metodo, cantidad, total_centimos )

reporting_consumo_productos( fecha, producto_id, cantidad, total_centimos )
```

## notifications

```sql
notifications_destinatarios(
  id, usuario_id, telefono_whatsapp, tipos_evento, activo )

notifications_plantillas(
  id, codigo, canal, cuerpo, activa )        -- variables {{cuarto}}, {{cliente}}…

notifications_cola(
  id, plantilla_id, destinatario, canal, payload,
  estado,                                    -- PENDIENTE | ENVIADO | FALLIDO
  intentos, ultimo_error, programado_para, enviado_en )
```

## scheduler

```sql
scheduler_timers(
  id, tipo,                                  -- LIMPIEZA | TOLERANCIA | EXCESO
                                             -- | CHECKOUT_PROXIMO | NO_SHOW
  entidad, entidad_id, vence_en,
  disparado_en, cancelado_en )
```

> Los timers son **durables**. Al arrancar, `scheduler` barre `vence_en <= now AND
> disparado_en IS NULL` y dispara lo pendiente. Un corte de luz de dos horas no pierde
> ni una alerta de exceso.

## audit · bus

```sql
audit_log(                                   -- solo-append, sin UPDATE ni DELETE
  id, entidad, entidad_id, accion,
  usuario_id, turno_id, ocurrido_en,
  antes_json, despues_json, motivo, ip )

bus_outbox(                                  -- entrega at-least-once
  id, evento, payload_json,
  creado_en, despachado_en, intentos )

bus_procesados( evento_id, consumidor, procesado_en )   -- idempotencia
```

---

## Índices que importan

```sql
CREATE INDEX ix_estadias_activas   ON stays_estadias(cuarto_id, estado)
                                   WHERE estado IN ('RESERVADA','EN_CURSO','EN_TOLERANCIA','EXCEDIDA');
CREATE INDEX ix_estadias_bloqueo   ON stays_estadias(cuarto_id, bloqueo_desde, bloqueo_hasta);
CREATE INDEX ix_ventas_turno       ON sales_ventas(turno_id, creado_en);
CREATE INDEX ix_ventas_usuario     ON sales_ventas(usuario_id, creado_en);
CREATE INDEX ix_lineas_venta       ON sales_lineas(venta_id, fase);
CREATE INDEX ix_mov_producto       ON inventory_movimientos(producto_id, ocurrido_en);
CREATE INDEX ix_timers_pendientes  ON scheduler_timers(vence_en) WHERE disparado_en IS NULL;
CREATE UNIQUE INDEX ux_venta_serie ON sales_ventas(serie, correlativo);
```

## Configuración de arranque

```sql
PRAGMA journal_mode = WAL;      -- lecturas concurrentes + 1 escritor
PRAGMA synchronous = NORMAL;    -- seguro con WAL, mucho más rápido
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```
