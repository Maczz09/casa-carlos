# Plan de implementación: ampliación de gráficos del dashboard

## Objetivo

Convertir el dashboard en una herramienta de decisión para recepción y administración. Cada gráfico debe responder una pregunta operativa concreta, compartir el rango de fechas global y permitir identificar una acción, no solo decorar la pantalla.

## Decisión técnica

- **Recharts** será la librería estándar del dashboard. Ya está instalada y el módulo usa `ResponsiveContainer`, por lo que los gráficos se adaptan al espacio disponible y conservan el patrón React existente.
- **Chart.js** se mantiene para visualizaciones puntuales ya usadas en Caja. No se incorporará al dashboard para representar datos que Recharts ya cubre, evitando dos sistemas de tooltip, leyenda, colores y accesibilidad.
- Se conservarán los tokens visuales actuales (`--c-brand`, `--c-line-soft`, `--c-surface`) y el soporte claro/oscuro. No se introducirán colores fijados para fondos o texto.

## Estado actual

| Dato disponible | Presentación actual | Mejora prevista |
| --- | --- | --- |
| Ventas, IGV y operaciones por día | Área de ventas e IGV | Gráfico compuesto con barras de operaciones y tooltip tributario completo |
| Ingresos por método | Barras HTML | Donut con monto, porcentaje y cantidad de operaciones |
| Ingresos por modalidad | Barras HTML | Barras horizontales comparables por monto y cantidad |
| Ocupación por piso/categoría | Barras HTML | Barras ordenadas y conmutador entre cuartos e ingresos |
| Ventas por recepcionista | Barra HTML | Ranking horizontal con total, ventas y ticket promedio |
| Productos y cargos | Barras HTML / estado vacío | Ranking visual con selector de métrica |
| Horas pico | Mapa de calor propio | Se conserva, con tooltip y leyenda de intensidad mejorados |

## Fase 1: modelo de datos y contrato

Ampliar `DashboardReport` y el servicio de reportes con datos que hoy no existen en serie temporal.

1. `ocupacionDiaria`: fecha, cuartos ocupados, cuartos disponibles y porcentaje de ocupación.
2. `flujoEstadiasDiario`: fecha, check-ins, check-outs y reservas creadas.
3. `ventasPorHora`: hora, ventas, IGV y número de operaciones, agrupadas según la zona horaria del hotel.
4. `ventasPorRecepcionista`: añadir ticket promedio para evitar comparar solo montos absolutos.
5. Mantener los importes en céntimos en servidor y convertir a soles solo en los adaptadores de cada gráfico.

**Criterio de aceptación:** el endpoint de dashboard devuelve series completas para todos los días del rango, incluido cero cuando no hubo movimiento.

## Fase 2: gráficos prioritarios de gestión

### 1. Evolución de ventas, IGV y operaciones

- **Pregunta:** ¿cuándo se vendió más y cuántas operaciones originaron ese ingreso?
- **Componente:** `ComposedChart` de Recharts.
- **Datos:** `serieTemporal` existente.
- **Visualización:** área de ventas brutas, línea de IGV y barras suaves de cantidad de ventas con eje derecho.
- **Interacción:** tooltip con total, valor de venta, IGV y operaciones del día.

### 2. Ocupación y flujo diario

- **Pregunta:** ¿qué días concentran ocupación, llegadas y salidas?
- **Componente:** `ComposedChart` de Recharts.
- **Datos:** `ocupacionDiaria` y `flujoEstadiasDiario` nuevos.
- **Visualización:** área de ocupación porcentual y barras agrupadas de check-in/check-out.
- **Interacción:** referencia visual al promedio del periodo y tooltip por día.

### 3. Distribución de cobros por método

- **Pregunta:** ¿cuánto dinero llegó por efectivo, Yape, Plin, bancos u otros medios?
- **Componente:** `PieChart` con `Pie` y etiqueta central.
- **Datos:** `ingresosPorMetodo` existente.
- **Visualización:** donut, total en el centro y leyenda externa con monto, porcentaje y operaciones.
- **Estado vacío:** texto explícito cuando no existan pagos aceptados; nunca un donut vacío.

### 4. Ingresos por modalidad

- **Pregunta:** ¿qué modalidad vende más y con qué frecuencia?
- **Componente:** `BarChart` horizontal.
- **Datos:** `ingresosPorModalidad` existente.
- **Visualización:** barras ordenadas por ingreso, con etiqueta de cantidad de alquileres.
- **Interacción:** selector `Soles | Operaciones` para no mezclar unidades en una sola escala.

**Criterio de aceptación:** estos cuatro gráficos se cargan y cambian juntos al aplicar fechas o los accesos rápidos Hoy, 7 días y Este mes.

## Fase 3: gráficos de optimización operativa

### 5. Rendimiento por recepcionista

- **Pregunta:** ¿cómo se reparte la operación entre el personal, sin confundir volumen con ticket promedio?
- **Componente:** `BarChart` horizontal.
- **Datos:** `ventasPorRecepcionista` ampliado.
- **Visualización:** total vendido por persona; tooltip con ventas y ticket promedio.
- **Regla:** mostrar solo usuarios con actividad en el rango y usar nombre de usuario eliminado solo si su histórico permanece.

### 6. Mix de habitaciones

- **Pregunta:** ¿qué categorías generan ingresos y cuántos cuartos se alquilaron?
- **Componente:** `BarChart` horizontal con conmutador.
- **Datos:** `ocupacionPorCategoria` existente.
- **Visualización:** `Ingresos` o `Cuartos alquilados`; una métrica por vez para mantener la escala clara.

### 7. Productos y cargos adicionales

- **Pregunta:** ¿qué extras contribuyen realmente al ingreso?
- **Componente:** dos `BarChart` compactos o un selector `Productos | Cargos`.
- **Datos:** `rankingProductos` y `cargosExtra` existentes.
- **Visualización:** top 5 por ingreso o por unidades, conmutables.
- **Regla:** conservar el estado vacío actual cuando no existan líneas de ese tipo.

### 8. Patrón horario de ingresos

- **Pregunta:** ¿en qué franjas conviene reforzar la recepción o revisar tarifas?
- **Componente:** `BarChart` de 24 horas.
- **Datos:** `ventasPorHora` nuevo; el mapa de calor existente seguirá mostrando check-ins por día/hora.
- **Visualización:** ingresos por hora con una guía de franjas configuradas para tarifas cuando existan.

**Criterio de aceptación:** los gráficos operativos no desplazan los KPI ni repiten la misma métrica con distinta forma.

## Fase 4: estructura e interacción

1. Mantener los cuatro KPI arriba, seguidos por las dos series temporales prioritarias.
2. Agrupar el donut de pagos y las modalidades en una fila de análisis comercial.
3. Agrupar categorías, recepcionistas, productos/cargos y patrón horario en una sección de optimización.
4. Usar una única paleta semántica: turquesa para ventas/ingresos, violeta para IGV/comparación, azul para ocupación, ámbar solo para alertas.
5. Implementar tooltips con formato `S/ 0.00`, porcentajes con un decimal y fechas `dd MMM` en español peruano.
6. Permitir ocultar/mostrar series mediante leyenda únicamente cuando un gráfico tenga más de dos series comparables.
7. Hacer que las tarjetas de gráfico se reordenen a una columna en pantallas estrechas, sin fijar anchos de canvas.

## Fase 5: accesibilidad y rendimiento

1. Acompañar cada gráfico con título, subtítulo y resumen textual de la conclusión principal.
2. No depender solo del color: leyendas, etiquetas y tooltips deben comunicar la serie.
3. Respetar `prefers-reduced-motion`; la entrada de los gráficos debe ser breve o desactivarse.
4. Desactivar animaciones de Recharts cuando el rango tenga más de 90 puntos o el usuario solicite menos movimiento.
5. Cargar el dashboard de forma diferida, como ya ocurre, y memoizar adaptadores de datos para no recalcular con cada render.
6. Probar con cero datos, un único dato, rangos de 7, 31 y 90 días, y datos de múltiples métodos de pago.

## Orden de implementación

1. Extender contrato, repositorio y servicio con las tres series nuevas.
2. Añadir adaptadores y tipos de formato en `DashboardModule`.
3. Sustituir la evolución actual por el gráfico compuesto.
4. Implementar ocupación/flujo diario, donut de pagos y barras por modalidad.
5. Implementar los cuatro gráficos de optimización.
6. Aplicar estados vacíos, responsive, tema oscuro, movimiento reducido y pruebas visuales.
7. Ejecutar typecheck, build y validación manual con datos reales del hotel.

## Criterios de entrega

- El dashboard muestra al menos ocho visualizaciones útiles, sin contar KPI.
- Cada visualización usa un dato real del backend y responde a una pregunta indicada en este plan.
- El filtro de fechas actualiza todas las gráficas de la misma consulta.
- No hay gráficos vacíos, ejes ambiguos ni valores monetarios sin formato.
- Claro, oscuro, escritorio y pantalla reducida conservan legibilidad.
- Recharts es la única librería de gráficos dentro del dashboard; Chart.js no se duplica allí.
