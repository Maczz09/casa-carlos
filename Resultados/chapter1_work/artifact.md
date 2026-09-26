# Contrato de edición del Capítulo I

## Referencia

- Documento: `C:\Users\maxmo\Downloads\Formato Proyecto.docx`
- SHA-256: `37100d1843d04c2f7737ced92327e2391950ba19de9cae63098d499ce4883ab7`
- Tamaño: 61 039 bytes.
- Render de referencia: 16 páginas en `template_render_word`.
- Secciones: 6.
- Evidencia de estilos: `template-style-evidence.json`.

## Sistema de página

- Papel A4. Secciones 1-3: vertical, márgenes 3,0 cm izquierda, 2,5 cm derecha y superior, 3,0 cm inferior.
- Sección 4: vertical, 3,0 cm laterales y 2,5 cm superior/inferior.
- Sección 5: horizontal, 2,5 cm laterales y 3,0 cm superior/inferior.
- Sección 6: vertical, igual a la sección 4.
- El Capítulo I pertenece a la sección 4, con numeración arábiga en el pie derecho.
- No cambiar secciones, orientación, márgenes, encabezados, pies ni saltos que delimitan capítulos.

## Tipografía y jerarquía

- Fuente predominante: Arial.
- `Heading 1`: títulos de capítulo centrados, negrita/subrayado según el modelo, interlineado doble.
- `Heading 2`: apartados 1.1 a 1.6, numeración automática e interlineado doble.
- `Heading 3`: subapartados, sangría de aproximadamente 1,5 cm e interlineado doble.
- `Normal`: cuerpo del texto. Conservar tamaño, márgenes, fuente y color heredados del documento.
- Cuerpo académico: alineación justificada, interlineado 1,5, primera línea 1,25 cm y 6 pt posteriores.

## Flujo y componentes

- Páginas 1-9: carátula, preliminares e índices; preservar.
- Capítulo I: sustituir únicamente los espacios de contenido de 1.1 a 1.6 y conservar los títulos/estilos.
- Capítulos II-IV, anexos y estructura general: preservar.
- Bibliografía: se permite incorporar solo las fuentes citadas en el Capítulo I, usando Arial, sangría francesa y espaciado académico.

## Mapa de slots editables

- `word/document.xml`, párrafo 50: reemplazar instrucción de 1.1 por la descripción macro-meso-micro.
- Párrafo 53: pregunta general.
- Párrafo 55: preguntas específicas.
- Párrafo 58: objetivo general.
- Párrafo 60: objetivos específicos.
- Párrafo 63: hipótesis general.
- Párrafo 65: hipótesis específicas.
- Párrafo 67: justificación e importancia.
- Párrafo 69: limitaciones.
- Bibliografía: agregar referencias al párrafo final de la sección correspondiente.
- Los apartados con múltiples elementos pueden crecer mediante párrafos clonados del mismo estilo antes del siguiente encabezado.

## Partes preservables

- `word/styles.xml`: `bb91c2ae5859bbd9f33c7d5a645f3868023d38ff3650e6c4f6274d5149816372`
- `word/numbering.xml`: `3993e7e0d8489166f216b12087d38e92f660dad8fc5c44b268b35ef45f0e6795`
- `word/settings.xml`: `75e32d30016ae16661710de6f18c091d206cc72973bb9ebcc2558317c7c312fe`
- `word/theme/theme1.xml`: `a6d6be71a15ce85bec1c2effef083250e6f60b3cc0ac6a632307180a5e9a304f`
- `word/media/image1.png`: `d58317c0993f1badccf9f98c51ede6a4318b295ad9b35417930ad6f6ab5084a2`
- Los tres pies de página y todo `customXml` son preserve-only.
- Solo `word/document.xml` puede cambiar por contenido y paginación; no eliminar relaciones.

## Hechos no definidos

- Unidad productiva, distrito, provincia y región del trabajo de campo.
- Variedad exacta del pimiento y criterio de madurez comercial.
- Modelo y especificaciones finales de la sonda NPK.
- Estos datos deben aparecer como campos visibles entre corchetes y no ser inventados.

## Puertas de fidelidad

- La referencia debe conservar el SHA-256 registrado.
- Pregunta, objetivo e hipótesis generales se mantienen textualmente como en la matriz aprobada.
- Las formulaciones específicas se alinean con N, P, K y clasificación visual, porque la arquitectura confirmada separa ambos módulos.
- Comparar estructura, secciones, estilos y partes preserve-only después de editar.
- Renderizar todas las páginas finales; no debe existir texto cortado, solapado, huérfano ni fuera de márgenes.
