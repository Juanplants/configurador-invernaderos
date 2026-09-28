# Traspaso — estado del proyecto y cómo seguir

Para retomar el trabajo en otra conversación o con otra persona. Leer junto a `docs/ESPECIFICACION.md`.

## Contexto en tres líneas

- Juan David (agrónomo, Almería) rediseña su configurador v0.3 como herramienta para **distribuidores** de invernaderos multitúnel, con catálogo propio de cada distribuidor.
- En paralelo pide presupuestos a fabricantes chinos (RFQ de dos modelos de referencia: A = 3 naves × 8 m × 44 m, B = 6 naves × 9,6 m × 88 m, 4,5 m a canal, pórticos cada 4 m). Sus listas de materiales servirán para **calibrar** las reglas del catálogo.
- El trabajo se hace en español; los textos para proveedores en inglés.

## Qué hay en el repositorio

| Ruta | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `js/app.js`, `js/propuesta.js` | Interfaz (base v0.3) **conectada al motor**. Usa el catálogo cargado con «Cargar catálogo» o, si no hay, `datos/catalogo-ejemplo.js` |
| `js/planos/hoja.js` | **Planos A3** (fase 4): hoja, escala, registro de textos, cotas, rótulos, leyenda y cajetín comunes, perfil del arco |
| `js/planos/planta.js`, `transversal.js`, `lateral.js`, `emplazamiento.js` | Hojas 01 planta, 02 alzado frontal, 03 alzado lateral, 04 sección transversal, 05 emplazamiento |
| `js/exportar.js` | Exportación de las hojas a **PDF vectorial A3** (escala real al imprimir en A3 al 100 %) |
| `js/proyecto.js` | **Guardar y abrir proyecto** (.json) con la identidad del catálogo (fase 5) |
| `js/excel.js` | **Lista de materiales en Excel** (SheetJS): hoja con precios y hoja de petición de oferta sin precios (fase 5) |
| `js/terreno/parcela.js` | **Parcela del Catastro** (fase 6): lee el GML (INSPIRE) o KML de la Sede sin conexión y lo pasa a metros; distancia exacta de un rectángulo a los linderos |
| `js/terreno/optimizador.js` | **Optimizador** (fase 6): mayor rectángulo útil por orientación, candidatas por modelo/ancho/separación/ventana cenital y puntuación por perfil de prioridad y orientación preferida |
| `js/terreno/croquis.js` | Croquis en planta (norte arriba) de las tarjetas del optimizador |
| `js/importador.js` | **Importador y validador del catálogo** (fase 1): lee la plantilla `.xlsx` en el navegador |
| `lib/` | Librerías copiadas para funcionar sin internet: SheetJS 0.18.5, jsPDF 4.2.1, svg2pdf.js 2.8.1 (versiones, origen y licencias en `lib/LEEME.md`) |
| `js/motor/` | **Motor de cálculo v0.4** (fase 2): expresiones, geometría, materiales, precios, avisos |
| `motor.html` | Página de prueba del motor con el catálogo de ejemplo (doble clic) |
| `datos/Catalogo_Plantilla_v0.4.xlsx` | Plantilla del catálogo, rellena con un **ejemplo de valores estimados** |
| `datos/catalogo-ejemplo.json` / `.js` | El mismo catálogo convertido (generado; no editar a mano) |
| `herramientas/catalogo_a_json.py` | Convierte la plantilla Excel en JSON/JS (misma conversión que `js/importador.js`) |
| `tests/referencia.py` | Implementación de referencia independiente en Python → `tests/esperado.json` |
| `tests/pruebas.js` | Pruebas del motor (147 comprobaciones) |
| `tests/importacion.js` | Pruebas del importador (36): plantilla correcta sin errores e igual al JSON de Python; copia con errores provocados |
| `tests/planos.js` | Pruebas de las cinco hojas (233 comprobaciones, 224 hojas): cero solapes en 1/2/5/10 naves × 10/20/60 tramos, dibujo ≥ 50 % del espacio, escala de la serie y la mayor que vale, textos en WinAnsi, lado largo horizontal, alzados enteros o interrumpidos según la regla, puertas; en la sección, arco, alturas y ventana cenital; en el emplazamiento, encaje, distancias a linderos y norte; con parcela real, norte arriba (o la hoja girada solo si así cabe a mayor escala), invernadero con su orientación real y a escala, distancia mínima exacta, cumple / no cumple / no cabe |
| `tests/hojas_de_prueba.js` | Casos comunes a las pruebas de planos (224 hojas, 16 sobre parcela real: norte-sur, este-oeste, oblicuo a 35° y 125°, con hueco, sin camino, no cabe, no cumple) |
| `tests/terreno.js` | Pruebas del terreno y el optimizador (104): GML = KML, UTM contra pyproj, huecos, varios recintos, sistemas y archivos malos; distancia a linderos; pesos = especificación; cada candidata cumple la holgura; cada medida con todas las ventanas cenitales; ninguna de las 3 en rojo de ventilación (y, sin mariposa en el catálogo, las rojas al final con aviso); la mejor de cada modelo + ventana; orientación preferida; misma orientación en croquis y plano; óptimo analítico en una parcela rectangular; un solo criterio → la mejor en ese criterio |
| `tests/terreno_navegador.js` | En la app sin conexión (60): cargar GML/KML, las 3 mejores = optimizador en node, ventana y aviso en las tarjetas, elegir (también la ventana), misma orientación en tarjeta y plano, orientación preferida este-oeste, planos y PDF, guardar/abrir con parcela, rectángulo a mano (se omite sin Playwright) |
| `tests/generar_parcelas.py` → `tests/datos/parcela_irregular.gml` / `.kml` | Parcela de ejemplo **inventada** (8 vértices, cóncava, ~4 ha) en formato del Catastro; necesita pyproj |
| `tests/salidas.js` | Pruebas de las salidas (50): proyecto (ida y vuelta, catálogo distinto, archivos malos), Excel (releído y comparado con el motor; oferta sin precios), propuesta (capítulos, distribuidor, planos A3, asteriscos en tres catálogos) |
| `tests/salidas_navegador.js` | Las tres salidas en la app sin conexión; propuesta impresa: A4 + una página A3 por plano a 420 × 297 mm (se omite sin Playwright) |
| `tests/pdf_navegador.js` | Exportación en Chromium sin conexión: nombres, páginas A3, escala real medida en el PDF, títulos, sin peticiones externas (se omite sin Playwright) |
| `tests/planos_navegador.js` | En Chromium, cada texto real cabe en su caja estimada (se omite sin Playwright) |
| `tests/generar_catalogo_con_errores.py` → `tests/datos/Catalogo_con_errores.xlsx` | Plantilla con 7 errores y 3 avisos provocados a propósito |
| `docs/` | Especificación, este traspaso, README de la v0.3 |

## Cómo comprobar que todo funciona

```bash
python3 herramientas/catalogo_a_json.py datos/Catalogo_Plantilla_v0.4.xlsx datos/catalogo-ejemplo.json
python3 tests/referencia.py
node tests/pruebas.js        # debe terminar con "0 fallos"
node tests/importacion.js    # ídem (si se cambia la plantilla: python3 tests/generar_catalogo_con_errores.py)
node tests/planos.js
node tests/planos_navegador.js   # opcional, necesita Playwright
node tests/pdf_navegador.js      # opcional, necesita Playwright
node tests/salidas.js
node tests/salidas_navegador.js  # opcional, necesita Playwright
node tests/terreno.js
node tests/terreno_navegador.js  # opcional, necesita Playwright
```

Y abrir `index.html` (configurador) o `motor.html` (página de prueba del motor) en el navegador.

## Uso del motor

```js
const r = MOTOR.calcular(catalogo, {
  modelo: 'MT-GOT-80', naves: 3, tramos: 11, altura_canal: 4.5, puertas: 1,
  seleccion: { ventilacion_cenital: 'C21' },  // null = sin ventana cenital
  zona: 'Almería',
  sitio: { viento_kmh: 100 }                  // opcional
});
// r.geometria, r.ventilacion, r.lineas (con traza), r.precio, r.avisos, r.emplazamiento
```

## Cargar un catálogo (fase 1)

Botón **Cargar catálogo** (arriba a la derecha) → elegir la plantilla `.xlsx` del distribuidor.

- Conversión igual que `catalogo_a_json.py`: cabecera en la fila 4, datos desde la fila 6, claves en snake_case; precios y obra local como número (acepta coma decimal).
- **Errores** (el catálogo no se acepta y se sigue usando el anterior): falta una hoja; Id repetido; referencia que no existe en Perfiles/Cubiertas/Equipos; regla de cantidad desconocida; fórmula o factor que `MOTOR.expresiones` no evalúa o que usa una variable inexistente; variantes con `|` que no cuadran con los modelos de la fila; modelo sin anchos, separaciones o alturas (o con coma decimal); flecha o peso de perfil no numéricos; componente de un modelo que no existe. Al final se calcula cada modelo con el motor como prueba.
- **Avisos** (se acepta igual): precio vacío o no numérico (la partida sale sin importe), obra local vacía.
- Cada incidencia indica hoja, fila, columna y qué falla.
- Aceptado → se usa en lugar del de ejemplo y se guarda en `sessionStorage`: aguanta recargas y se olvida al cerrar la pestaña. «Volver al de ejemplo» lo descarta.
- La **medida por defecto** de ancho, separación y altura es la primera de su lista en la hoja Modelos: el distribuidor la ordena para poner delante la habitual (el ejemplo usa `4.5;4;5`).

## Planos (fase 4)

Hojas A3 en milímetros (`viewBox 0 0 420 297`): impresas en A3 la escala del cajetín es real; reducidas (pantalla, propuesta en A4) vale la escala gráfica.

- **Zonas:** marco UNE-EN ISO 5457 (20 mm a la izquierda, 10 mm en el resto); cajetín 180 × 50 abajo a la derecha; leyenda y escala gráfica a su izquierda; encima, el dibujo con sus bandas de ejes y cotas.
- **Escala:** serie UNE-EN ISO 5455 más las intermedias de construcción: 1:20, 1:50, 1:100, 1:200, 1:250, 1:300, 1:400, 1:500, 1:1000, 1:2000. Cada hoja se dibuja de la mayor a la menor y se queda con la primera en la que caben el dibujo, sus cotas, ejes y rótulos obligatorios (`HOJA.mejorEscala`). Prueba de encaje: el dibujo ocupa al menos el 50 % del ancho o del alto disponible.
- **Planta:** el lado largo siempre en horizontal (si el ancho total es mayor que el largo, la planta va girada: 10 × 9,60 × 80 m sale a 1:500). Norte opcional (`orientacion`: azimut del eje largo) que gira con la planta; lo dará la hoja de emplazamiento.
- **Cajetín:** incluye «Plano informativo de oferta. No válido para ejecución ni tramitación.»
- **Ejes:** pórticos numerados (1, 2, 3…), líneas de pilares con letras (A, B, C…). Si las burbujas no caben todas, se rotula uno de cada 2, 5 o 10, siempre el primero y el último.
- **Cotas:** fuera del dibujo; cadena de vanos por dentro y total por fuera. Si el texto de cada vano no cabe entre sus líneas, se agrupan los vanos iguales (`60 × 4,00`).
- **Registro de cajas** (`HOJA.Registro`): cada texto, burbuja, línea de cota y el contorno del dibujo apuntan su caja; un texto se coloca en la primera posición candidata que no pisa nada. Si un texto obligatorio no cabe, queda en `fallos`. El ancho de los textos se estima con una tabla por carácter holgada; `tests/planos_navegador.js` comprueba en Chromium que el texto real cabe.
- **Hojas hechas:** 01 planta, 02 alzado frontal, 03 alzado lateral, 04 sección transversal, 05 emplazamiento (si hay parcela).
- **Emplazamiento (05):** parcela rectangular introducida a mano (largo, ancho y ángulo de su lado largo respecto al norte), dibujada con el lado más largo en horizontal y la flecha del norte girada. Invernadero centrado, paralelo o girado 90°, con las distancias a los cuatro linderos acotadas; si no cabe, se dibuja igual con el aviso «El invernadero no cabe en la parcela» y lo que falta (también en el resumen de la app). Con parcela, la planta dibuja el norte. Con la parcela del Catastro (fase 6) dibuja el polígono real: ver «Terreno y optimizador».
- **Textos:** todos pasan por `HOJA.aWinAnsi` (juego de la Helvetica del PDF); un carácter fuera de él se sustituye (≈ → «aprox.») o sale como «?».
- **Sección y alzado frontal:** arco dibujado como la parábola de luz = ancho de nave y flecha del catálogo (la misma forma con la que el motor calcula longitud de arco y volumen). Alturas a canal, flecha y cumbrera acotadas. Si el invernadero entero cabe a 1:300 o mayor, se dibuja completo; si no, se interrumpe a la mayor escala en la que quepan al menos 2 naves, con tantas como llenen el ancho (p. ej. 15 naves de 9,60 m: 3 naves a 1:100). La cota de la interrupción dice cuántas naves faltan y la total es la real.
- **Puertas:** medidas de la hoja Equipos («Ancho puerta», «Alto puerta»); cantidad de la partida de puertas. Una por nave en el hastial frontal y el resto en el trasero, en el hueco entre pilares de hastial más centrado de la nave. Se dibujan en planta (hoja corredera por fuera del hastial) y en el alzado frontal.
- **Ventana cenital en la sección:** según la opción elegida (1 línea = una hoja, 2 = mariposa, ninguna = techo cerrado), con bisagra en la cumbrera, hoja cerrada sobre el arco y abierta a 2·arcsen(rendija / 2·hoja). Los datos salen del resultado del motor (`r.ventilacion`), así coinciden con la lista de materiales. Rótulo obligatorio con línea de referencia.
- **Alzado lateral:** ventana cenital del 2.º al penúltimo pórtico (`long_ventana_cenital`) y ventana lateral si la hay (posición orientativa). Sus rótulos son opcionales: con 60 tramos a 1:1000 las burbujas no dejan paso; el dato va siempre en las notas.
- **PDF** (`js/exportar.js`): «Descargar planos (PDF A3)» genera un PDF con todas las hojas y «Esta hoja (PDF)» la pestaña actual; nombre `<código>_planos_<AAAA-MM-DD>.pdf` o `<código>_<nº>-<hoja>_<AAAA-MM-DD>.pdf`. Cada hoja es una página A3 apaisada con el SVG en mm 1:1 (vectorial, Helvetica); impresa en A3 «al 100 % / tamaño real» la escala del cajetín es exacta; el PDF pide al visor no reescalar.
- **En espera de datos del fabricante:** detalles constructivos y cimentación (no empezar hasta tenerlos).
- **Estética (pendiente, no implementado):** en los alzados sobra espacio vertical por la forma alargada del invernadero. Cuando se retoquen los planos, valorar juntar alzado frontal y sección transversal en una misma hoja A3.

## Salidas (fase 5)

- **Guardar / abrir proyecto** (sección Proyecto): `<código>_proyecto_<fecha>.json` con todo lo introducido (modelo, geometría, opciones, puertas, zona, viento, parcela, datos del cliente, pestaña) y la identidad del catálogo (nombre, versión, fecha, archivo y huella FNV-1a del contenido). No incrusta el catálogo. Al abrir: huella distinta → aviso (aunque coincidan nombre y versión); modelo que no está en el catálogo cargado → no se abre; opciones o zona que ya no existen → se descartan con aviso.
- **Excel** (botón en la lista de materiales): `<código>_materiales_<fecha>.xlsx`. Hoja «Materiales»: categoría, partida, referencia, cantidad, unidad, kg, precio unitario, importe, origen del catálogo y cálculo; al final obra local, base, IVA y total. Hoja «Petición de oferta»: sin precios, encabezados en español e inglés, datos del invernadero, especificación de cada referencia y columnas vacías para el precio y las observaciones del fabricante.
- **Propuesta**: capítulos = categorías del catálogo, con el texto de propuesta de cada partida; distribuidor en portada y en «Datos de la oferta»; cada plano en una página A3 apaisada propia (CSS `@page plano-a3`) a escala real al imprimir, el resto en A4; nota de planos informativos. Todo valor que sea o dependa de un dato estimado lleva asterisco (partidas, precios por categoría y totales, acero, ventilación, altura a cumbrera, volumen, garantía).

## Terreno y optimizador (fase 6)

- **Parcela del Catastro** (Emplazamiento → «Cargar parcela del Catastro»): el GML (INSPIRE, `cp:CadastralParcel`, `gml:Polygon` o `gml:PolygonPatch`) o el KML que el usuario descarga de la Sede; se lee del disco, sin conexión. Sistemas: ETRS89/WGS84 UTM husos 28-31 (EPSG 25828-31, 32628-31), geográficas (4258, 4326; en GML el orden es latitud, longitud) y ED50 (23028-31) con aviso. Se pasa a un plano local en metros (x al este, y al norte, radios del elipsoide GRS80): son medidas **reales en el terreno**, un 0,04 % mayores que las del plano UTM (la superficie declarada del Catastro es la del plano UTM). Huecos interiores y varios recintos (se usa el mayor) con aviso; aviso si la superficie difiere > 2 % de la declarada. Referencia catastral de `nationalCadastralReference`/`localId` o del nombre del KML. Con parcela del Catastro se ocultan los campos del rectángulo a mano; «Quitar parcela» vuelve a ellos.
- **Retranqueos y orientación** (datos del proyecto, se guardan en el .json): retranqueo a linderos (3 m por defecto) y camino perimetral (4 m). La distancia mínima exigida es **la mayor de las dos** (el camino puede ir dentro del retranqueo; confirmado en la revisión del PR #8); se aplica también a la parcela rectangular. Orientación preferida de la cumbrera: norte-sur (defecto), este-oeste o indiferente. Valores por defecto a revisar con la normativa de cada municipio.
- **Optimizador** (`OPTIMIZADOR.buscar`): para cada orientación cada 5° (0-175°; con el rectángulo a mano, solo la de la parcela y la girada 90°) rasteriza la parcela en el marco girado (220 celdas en el lado mayor; útil = dentro, fuera de huecos y a la holgura del lindero) y obtiene, para cada ancho, el mayor largo libre (histograma por filas). Para cada modelo apto (el no apto por viento se descarta con aviso), ancho de nave, separación y nº de naves, los tramos que caben (máx. `max_longitud`, mín. 2); después se ajusta con la geometría exacta (la rejilla es conservadora) y se prueba un tramo más. Cada combinación pasa por el motor **con cada ventana cenital del catálogo para ese modelo** (grupo `ventilacion_cenital`: una hoja, mariposa…) y se puntúa: coste = (€/m² máx − €/m²)/(máx − mín), superficie = área/área máx, ventilación = (v − mín)/(máx − mín), orientación según la preferida (N-S |cos azimut|, E-O |sin azimut|, indiferente 1), con los pesos del perfil (apartado 5). Las que quedan por debajo del **límite rojo de ventilación** (15 %, `avisos.CONFIG`) aun con la mejor ventana van siempre detrás y, si llegan a mostrarse, con aviso en rojo. Las 3 mejores son **distintas de verdad**: la mejor de cada modelo + ventana (si hay menos de 3 grupos, se completa con otra orientación y, al final, con otro nº de naves). Tarda ≈ 1 s con el catálogo de ejemplo.
- **Elegir** una tarjeta rellena modelo, ventana cenital, naves, tramos, ancho y separación, guarda la implantación (centro, azimut) y abre el emplazamiento; con el rectángulo a mano marca «girado 90°» si hace falta. Si luego se cambian las medidas a mano, el invernadero se vuelve a encajar (mejor orientación en la que cabe) o se avisa de que no cabe.
- **Plano de emplazamiento con parcela real**: parcela con el **norte arriba** e invernadero con su orientación real, igual que en el croquis de la tarjeta; la hoja entera (parcela, invernadero y flecha) solo se gira 90° si así cabe a una escala mayor. Lindero (y huecos), invernadero con canales, banda del camino perimetral, **cotas alineadas** con los lados del invernadero (valen en cualquier orientación) y **distancia mínima exacta** al lindero (línea entre los dos puntos más cercanos). Avisos «NO CABE» (sin implantación posible) y «NO CUMPLE LA DISTANCIA A LINDEROS».
- **Ejemplo** (parcela inventada, 4 m a linderos, perfil Equilibrado, norte-sur): 1) MT-GOT-96 con mariposa, 14 naves × 30 tramos (16.128 m², 22,16 €/m², 15,0 %); 2) MT-GOT-80 con mariposa, 15 × 30 (14.400 m², 22,58 €/m², 17,9 %); 3) MT-GOT-80 con una hoja, 4 × 30 (3.840 m², 22,63 €/m², 16,2 %). Antes de la revisión salían tres veces el mismo modelo con una hoja al 8,4 %: con 15 naves ni la mariposa llega al 15 % (14,9 %).
- Pendiente: zona de viento/nieve automática por municipio desde la referencia catastral; pendiente del terreno.

## Siguientes pasos (en orden)

1. ~~**Fase 1 — importador en el navegador**~~ **Hecho** (2026-09-28): ver «Cargar un catálogo». Pendiente menor: actualizar SheetJS a 0.20.3 cuando se pueda descargar de `cdn.sheetjs.com` (instrucciones en `lib/LEEME.md`).
2. ~~**Conectar el motor a la interfaz** de la v0.3~~ **Hecho** (2026-09-28): `calculos.js`, `modelos.js` y `opciones.js` retirados. Modelos, alturas/anchos/separaciones admitidos, opciones de envolvente (grupos de alternativas y opcionales), zonas de obra local, avisos, lista de materiales con «ver cálculo» y propuesta salen del catálogo y del motor. Los planos dibujan con la geometría del motor y rotulan los perfiles del catálogo.
3. **Fase 3 — calibración** en cuanto llegue una lista de materiales estándar con pesos (CFGET y Ruineng la han prometido): volcarla en la plantilla y ajustar reglas hasta ≤ 5 % en acero total.
4. **Fase 4 — planos** según el apartado 6 de la especificación: planta, alzados, sección, emplazamiento y PDF hechos (ver «Planos»); detalles y cimentación esperan datos del fabricante.
5. **Fase 5 — salidas**: proyecto .json, Excel y propuesta hechos (ver «Salidas»); falta el paso a paso de la interfaz (flujo de 6 pasos de la especificación).
6. ~~**Fase 6 — terreno y optimizador**~~ **Hecho** (2026-09-28): ver «Terreno y optimizador». Falta probarlo con parcelas reales de clientes (sin subirlas al repositorio).

## Reglas de trabajo

- Ningún dato de producto en el código: todo en el catálogo.
- Valores estimados siempre marcados con `origen: estimado`.
- No subir al repositorio documentos de terceros (ofertas de otras empresas, presupuestos de montadores); sus cifras solo como referencia en el catálogo de ejemplo.
- Commits pequeños, mensajes en español.
