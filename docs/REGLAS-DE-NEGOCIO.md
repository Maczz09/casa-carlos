# Casa Carlos — Reglas de negocio

Estas son las reglas que hacen difícil el sistema. Todo lo demás es CRUD.

---

## 1. Máquina de estados del cuarto

```
                    ┌──────────────────────────────────────┐
                    │                                      │
              ┌─────▼──────┐  reservar   ┌────────────┐    │
              │ DISPONIBLE ├────────────►│ RESERVADO  │    │
              └─────┬──────┘             └─────┬──────┘    │
                    │                          │           │
                    │ check-in walk-in         │ check-in  │
                    │                          │           │
              ┌─────▼──────────────────────────▼──────┐    │
              │              OCUPADO                  │    │
              │  vence  ┌──────────────┐   +15 min    │    │
              │  ──────►│ EN_TOLERANCIA├──────────►   │    │
              │         └──────────────┘  EXCEDIDO    │    │
              └─────────────────┬─────────────────────┘    │
                                │ check-out                │
                          ┌─────▼──────┐   5 min           │
                          │  LIMPIEZA  ├───────────────────┘
                          └────────────┘

     DISPONIBLE ◄──────────► FUERA_DE_SERVICIO   (manual, con motivo)
```

**Invariantes**

- De `OCUPADO` **jamás** se pasa directo a `DISPONIBLE`. Siempre pasa por `LIMPIEZA`.
- `LIMPIEZA` se activa **manualmente** por el recepcionista tras el check-out, y libera
  sola a los 5 minutos.
- `EN_TOLERANCIA` y `EXCEDIDO` son subestados de `OCUPADO`: el cuarto sigue ocupado,
  cambia el color y las alertas.
- El estado del cuarto es **derivado** de la estadía activa + banderas físicas
  (`cleaning_until`, `out_of_service`). No se guarda como campo editable a mano.

## 2. Semáforo de piso

```
verde  ⟺  cuartos_activos_del_piso.filter(DISPONIBLE).length ≥ 1
rojo   ⟺  cuartos_activos_del_piso.filter(DISPONIBLE).length == 0
```

Un solo cuarto libre basta para verde. Los cuartos `FUERA_DE_SERVICIO` no cuentan
en el denominador. Se recalcula en cada `room.status_changed` y se empuja por WebSocket.

---

## 3. Motor de tarifas

### Entrada
`(categoria_cuarto, modalidad, momento_inicio, cantidad_noches)`

### Resolución

1. **Temporada** — la activa para la fecha. Si dos se solapan, gana la de mayor
   `prioridad`.
2. **Franja horaria** — la última franja cuyo `hora_inicio ≤ hora_actual`.
   **Con vuelta a medianoche:** si son las 08:00 y las franjas son 10:00 / 16:00 / 23:00,
   la vigente es la de **23:00** del día anterior. Este caso es el que más se rompe si
   no se programa explícitamente.
3. **Tarifa** — `precio(franja, categoría, modalidad)`.
4. **Escala de noches** — si la modalidad es de noche y `n > 1`, aplica la tabla de
   escala (monto total creciente, no `precio × n`).
5. **Congelado** — el precio resuelto se copia a la línea de venta. Si el admin edita
   la tarifa después, **las ventas ya emitidas no cambian**.

### Ejemplo de configuración

```
Temporada "Verano 2026"  ·  vigencia 01-ene → 31-mar  ·  4 franjas

  00:00 ──── 10:00 ──── 16:00 ──── 23:00 ──── 24:00
  │ madrugada │ mañana  │  tarde   │  noche  │
  
  Categoría          Franja      3 horas   Noche A   Noche B
  ─────────────────────────────────────────────────────────
  Matrimonial c/vent  madrugada   S/ 45     S/ 90     S/ 80
  Matrimonial c/vent  mañana      S/ 40     S/ 85     S/ 80
  Matrimonial c/vent  tarde       S/ 50     S/ 95     S/ 85
  Matrimonial c/vent  noche       S/ 60     S/ 110    S/ 100
  …

Escala de noches (Noche A, matrimonial c/vent)
  1 noche → S/ 95   ·   2 → S/ 185   ·   3 → S/ 270   ·   4 → S/ 350
```

El número de franjas es dato, no código: si el admin pone 3, hay 3; si pone 6, hay 6.

---

## 4. Modalidades y tiempos

| Modalidad | Duración | Check-in | Check-out | Tolerancia |
|---|---|---|---|---|
| Por horas | 3 h por bloque | Al momento | inicio + 3 h | 15 min |
| Noche A | 20 h | 14:00 | 10:00 (día+1) | 15 min |
| Noche B | 12 h | 20:00 | 08:00 (día+1) | 15 min |
| Multi-noche | n × noche | según modalidad | último día | 15 min |

### Línea de tiempo del exceso

```
  inicio        fin_previsto          fin + 15'
    │                │                    │
    ├────────────────┼────────────────────┼──────────────►
    │    OCUPADO     │   EN_TOLERANCIA    │   EXCEDIDO
                     │                    │
              alerta en pantalla    WhatsApp a admin
              (y 15' antes también)  + recepcionista
                                     + cargo a definir
```

**Al cruzar `fin_previsto + 15 min`:**

1. La estadía pasa a `EXCEDIDO`.
2. Se emite `stay.overstayed`.
3. `notifications` envía WhatsApp a **admin y al recepcionista del turno** con:
   cuarto, piso, nombres y DNI del cliente, modalidad, hora de check-in, hora límite,
   minutos excedidos, consumo de bodega pendiente y monto sugerido de recargo.
4. El recepcionista **fija el monto** del cargo (UC PAG/REC-12). El sistema sugiere,
   no impone.

---

## 5. Check-in anticipado

Escenario del requerimiento: reserva Noche A (ventana 14:00 → 10:00), el cliente llega
a las 07:00 y quiere entrar.

```
horas_anticipadas = ceil( (hora_checkin_pactada − hora_llegada) / 1h )
cargo = horas_anticipadas × tarifa_hora_anticipada
```

Con llegada 07:00 y check-in pactado 14:00 → 7 horas → cargo = 7 × tarifa configurada.

**Precondiciones:** el cuarto debe estar `DISPONIBLE` (no ocupado por otra estadía, no
en limpieza). Si no lo está, el sistema no ofrece la opción.

El cargo entra como línea `CARGO_EXTRA / EARLY_CHECKIN` de la venta y se cobra junto
con el hospedaje.

---

## 6. Bloqueo por reserva de noche

> "las reservas de checkin y checkout, por ejemplo la de las 14:00, ese cuarto permanece
> ocupado todo el día y no se debe permitir alquilar hasta después del checkout"

```
Reserva Noche A creada para el día D
  ⇒ cuarto bloqueado desde 00:00 de D hasta el check-out real de D+1
  ⇒ no admite alquiler por horas ese día
  ⇒ el kiosco lo muestra OCUPADO desde que se crea la reserva
```

Implementado como un rango `[bloqueo_desde, bloqueo_hasta)` en la reserva. Toda
solicitud de alquiler valida contra la unión de rangos bloqueados del cuarto.
Parámetro `bloqueo_dia_completo` (por defecto `true`) por si el dueño luego quiere
aprovechar la mañana.

**Sin reembolsos.** Anular una reserva no genera nota de crédito ni devolución; se
registra el motivo y queda en auditoría.

---

## 7. Adicionales antes y después del pago

Cada línea de venta lleva una **fase**:

| Fase | Cuándo | Efecto |
|---|---|---|
| `PRE_PAGO` | `created_at ≤ venta.pagada_at` | Suma al total a cobrar |
| `POST_PAGO` | `created_at > venta.pagada_at` | Genera **saldo pendiente** |

Aplica a productos de bodega **y** a los cargos por exceso de tiempo — se comportan
igual: si ocurren después de pagar, son saldo.

```
El check-out exige saldo_pendiente == 0.
```

El recepcionista cobra el saldo con cualquier método (incluido híbrido) antes de
liberar el cuarto.

---

## 8. Pagos

### Detalle exigido por método

| Método | Qué muestra el kiosco | Qué ingresa el recepcionista |
|---|---|---|
| Efectivo | Monto a pagar | Monto recibido → calcula vuelto |
| Yape | QR del titular | **Código de 3 dígitos** |
| Plin | QR del titular | Código de operación |
| Lemon | QR / datos | Referencia |
| Agora | QR / datos | Referencia |
| Transferencia | Banco, N.º de cuenta y **CCI** | ID de operación + **nombres y apellidos del ordenante** |
| POS crédito | — | N.º de operación del voucher |
| POS débito | — | N.º de operación del voucher |

### Pago híbrido

Un pago tiene 1..n detalles. Regla dura:

```
Σ detalles.monto == venta.total          (aritmética en céntimos, nunca float)
```

Cualquier combinación es válida: efectivo + Yape, transferencia + efectivo,
POS + billetera, tres métodos a la vez. Cada detalle exige su código según la tabla
anterior.

### Aceptación

El pago nace `PENDIENTE`. **Solo el recepcionista lo pasa a `ACEPTADO` o `RECHAZADO`.**
El sistema nunca acepta un pago solo. Al aceptar:

`payment.accepted` → `sales` cierra la venta → `stays` habilita el check-in →
`cashbox` registra el movimiento en el turno abierto.

---

## 9. Caja y cuadre

### Efectivo esperado

```
esperado_efectivo = monto_apertura
                  + Σ pagos_efectivo_del_turno
                  + Σ ingresos_manuales
                  − Σ egresos_manuales
                  − Σ vueltos_entregados

diferencia = declarado_por_recepcionista − esperado_efectivo
```

### Métodos digitales

No se cuentan físicamente. El cuadre lista el total por método (Yape, Plin, Lemon,
Agora, transferencias, POS) con sus códigos de operación, para que el admin concilie
contra el estado de cuenta o la app.

### Cierre

- Si `|diferencia| > umbral` (configurable), el cierre exige justificación escrita.
- El cierre de un turno es la apertura del siguiente (traspaso).
- Cada venta queda ligada a `turno_id` y `usuario_id` — de ahí sale la comparativa
  entre recepcionistas del dashboard.

---

## 10. Espejo kiosco ↔ recepción

```
REC                      GATEWAY (WS)                   KIOSCO
 │                            │                            │
 ├─ abre venta ──────────────►│                            │
 │  (modalidad elegida)       ├─ sesión creada ───────────►│  sale de espera
 │                            │                            │
 │◄─── piso seleccionado ─────┤◄─────── toca 3.º piso ─────┤
 │◄─── cuarto seleccionado ───┤◄─────── toca cuarto 302 ───┤
 │◄─── producto agregado ─────┤◄─────── agrega gaseosa ────┤
 │     (ve el total en vivo)  │                            │
 │                            │                            │
 ├─ TOMA CONTROL ────────────►│                            │
 ├─ elige método por él ─────►├─── pantalla actualizada ──►│
 │                            │                            │
 │◄─── pago enviado ──────────┤◄─────── confirma ──────────┤
 ├─ ingresa código 3 dígitos  │                            │
 ├─ ACEPTA ──────────────────►├─── "Aceptado · cuarto 302"►│
 │                            │                            │
```

Una `SesionKiosco` es la fuente de verdad; ambas pantallas son vistas de ella.
`actor_activo` indica quién manda (`CLIENTE` o `RECEPCION`) y se puede transferir en
cualquier momento. Si el kiosco se desconecta, la sesión sobrevive y el recepcionista
termina el flujo solo.

---

## 11. Auditoría

> "permitir siempre modificar las ventas y reservas"

Modificar siempre se puede. Por eso **todo cambio queda registrado**:

```
audit_log (
  id, entidad, entidad_id, accion,
  usuario_id, turno_id, ocurrido_en,
  antes JSON, despues JSON, motivo
)
```

Entidades auditadas: ventas, líneas de venta, pagos, reservas, estadías, tarifas,
stock y turnos. El log es **solo-append**: nunca se actualiza ni se borra.

---

## 12. Dinero

Todo monto se guarda como **entero en céntimos**. Nada de `float`, nada de `number`
con decimales. `packages/money` expone `Money` con suma, resta, reparto y formato
`S/ 0.00`. El reparto de un pago híbrido usa reparto por resto para que la suma cierre
exacta al céntimo.
