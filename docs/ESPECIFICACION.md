# Configurador de Invernaderos — Especificación v0.4 (resumen)

> Documento vivo completo: https://claude.ai/code/artifact/aacfe893-178f-44b8-980b-f3cd2b053e03
> Este archivo es el resumen de trabajo que viaja con el código. Última revisión: 2026-09-28.

## 1. Propósito y alcance

Herramienta para que un **distribuidor de invernaderos** pase de unas medidas o un terreno a una propuesta con planos y presupuesto desglosado, usando **su propio catálogo**.

- **Usuario:** comercial o técnico del distribuidor. El cliente final solo ve la propuesta.
- **Solo multitúnel de film.** El parral queda fuera por decisión de diseño (ventilación insuficiente, sobrecalienta en verano). Venlo fuera hasta que haya demanda.
- **Local, sin instalación:** HTML + JavaScript, se abre con doble clic.
- **Fuera de la v0.4:** cadena de importación y margen (FOB/CIF/aranceles), clima y riego, dimensionado estructural (solo se comparan cargas del sitio con las declaradas), usuarios/nube.

## 2. Flujo de uso (6 pasos)

1. **Proyecto** — cliente, código, ubicación.
2. **Emplazamiento** — referencia catastral (GML/KML del Catastro) o coordenadas; zona de viento y nieve automática por municipio (tabla CTE incluida); categoría de terreno guiada; pendiente manual. Resultado por modelo: **apto / al límite / no apto–requiere cálculo**. Se comprueba antes de diseñar.
3. **Geometría** — modelo + naves + tramos, o desde terreno (el optimizador propone las 3 mejores).
4. **Envolvente** — ventilación, cerramiento, puertas, malla.
5. **Revisión** — lista de materiales, precio, avisos.
6. **Salidas** — planos, propuesta PDF, lista de materiales en Excel, archivo del proyecto.

Pantalla aparte: **Catálogo** (importar la plantilla Excel del distribuidor y validarla).

## 3. Catálogo (plantilla Excel, `datos/Catalogo_Plantilla_v0.4.xlsx`)

El código no contiene datos de producto. Cambiar de fábrica = cambiar este archivo.

| Hoja | Contenido |
| --- | --- |
| Empresa | Nombre, logo, moneda, IVA, condiciones, garantías |
| Modelos | Anchos de nave, separaciones entre pórticos y alturas admitidas; flecha; máximos; cargas declaradas; ancho de hoja cenital; separación de pilares de hastial; kg de arriostramiento por juego |
| Perfiles | Piezas de acero con kg/m y precio por kg o por metro |
| Componentes | Cada partida con su **regla de cantidad**, factor, grupo de alternativas, precio |
| Cubiertas | Films, mallas, placas con propiedades físicas (transmisión, U, factor de paso de aire) |
| Equipos | Motores (m de ventana por motor), cuadros, puertas (ancho y alto), tipos de ventana (líneas por nave, recorrido de cremallera, alto) |
| Obra local | Por zona: movilización (€/obra), montaje (€/m²), hoyos y dados (€/pilar). **La rellena cada distribuidor** |
| Variables | Medidas que pueden usar las reglas (solo lectura) |

**Reglas de cantidad:** `por_pilar`, `por_pilar_hastial`, `por_portico_nave`, `lineas_x_longitud`, `superficie_cubierta`, `superficie_cerramiento`, `perimetro`, `por_ventana`, `fija`, `porcentaje`, `formula` (expresión segura con las variables; sin código arbitrario).

**Convenciones:** listas con `;`; variantes por modelo con `|` en Ref y Factor (mismo orden que la columna Modelos); columna **Origen** (fabricante / literatura / tienda / estimado) — la propuesta nunca presenta un valor estimado como dato del fabricante.

## 4. Motor de cálculo (`js/motor/`)

Geometría derivada → comprobación del emplazamiento → lista de materiales → precios → avisos. El motor no toca la pantalla.

- **Volumen** con la sección real del arco (no media de alturas).
- **Traza** por línea («ver cálculo»), solo visible para el distribuidor.
- **Ventilación efectiva** = hueco de ventana × factor de paso de aire de la malla. Cenital: naves × líneas × longitud de ventana × recorrido de cremallera (rendija ≈ recorrido). Lateral: 2 × largo × alto.
- **Avisos:** ventilación efectiva < 20 % del suelo (ámbar) o < 15 % (rojo), mostrando el % cenital aparte; fuera de rango del modelo; al límite / no apto (margen 10 %); partida sin precio; > 5 ha; nº de partidas con valores estimados.
- **Precios:** cantidad × precio, subtotales por categoría, obra local, IVA, €/m², kg de acero y kg/m².

## 5. Terreno y optimizador

Mayor rectángulo útil dentro de la parcela (orientaciones cada 5°), candidatas por modelo apto / ancho / separación, puntuación por **perfil de prioridad elegido en cada proyecto**:

| Perfil | Coste €/m² | Superficie | Ventilación | Orientación |
| --- | --- | --- | --- | --- |
| Equilibrado (defecto) | 40 % | 30 % | 20 % | 10 % |
| Aprovechar la parcela | 25 % | 50 % | 15 % | 10 % |
| Mínimo coste | 60 % | 20 % | 10 % | 10 % |
| Clima y ventilación | 25 % | 20 % | 40 % | 15 % |

Salida: las 3 mejores con croquis en planta. Planos completos solo para la elegida.

## 6. Planos arquitectónicos

Hojas A3 con zonas reservadas (dibujo, bandas de cotas, cajetín 180×50 mm, leyenda); escala real de la serie UNE-EN ISO 5455 más las intermedias de construcción (1:20…1:2000, incluidas 1:250, 1:300 y 1:400), la mayor con la que caben dibujo, cotas, ejes y rótulos, + escala gráfica; planta con el lado largo en horizontal; alzados enteros si caben a 1:300 o mayor (si no, interrumpidos); cajetín con la nota «Plano informativo de oferta. No válido para ejecución ni tramitación.»; ejes con números y letras; grosores de línea por elemento; cotas en cadena y totales fuera del dibujo; rótulos con línea de referencia; registro de cajas de texto para **cero solapes**. Hojas: emplazamiento, planta, alzados, sección, detalles, cimentación. Visor con pestañas; exportación dentro del dossier y como PDFs sueltos por hoja. DXF más adelante.

## 7. Propuesta y exportaciones

Estructura de la v0.3 + emplazamiento, cargas del sitio vs declaradas, capítulos generados desde el catálogo, marca del distribuidor. Exporta PDF, lista de materiales en Excel (sirve también como RFQ) y proyecto en JSON.

## 8. Clima y riego (fase posterior)

Nivel A (balances simples: renovaciones/hora, potencia de calefacción, efecto de pantalla/nebulización, riego por ETc) antes que nivel B (simulación horaria). El catálogo ya guarda las propiedades físicas.

## 9. Fases

| Fase | Estado | Se acepta cuando |
| --- | --- | --- |
| 1. Catálogo | **Hecho** (`js/importador.js`, `lib/`, `tests/importacion.js`): «Cargar catálogo» lee la plantilla sin internet, la valida (hoja, fila, columna) y la guarda en la sesión | Importa la plantilla y detecta errores provocados |
| 2. Motor | **Hecho** (`js/motor/`, `tests/`) | Coincide con la referencia independiente y con 63 pilares / 42 cerchas de la v0.3 |
| 3. Calibración | Espera listas de materiales de fábrica | Acero total ≤ 5 % de desviación frente al fabricante |
| 4. Planos | En curso: hojas A3 de **planta, alzados, sección y emplazamiento** con puertas, y **PDF A3** a escala real (`js/planos/`, `js/exportar.js`; `tests/planos.js`: cero solapes y ≥ 50 % de ocupación en 208 hojas); detalles y cimentación esperan datos del fabricante | Cero solapes en 1/2/5/10 naves × 10/20/60 tramos |
| 5. Interfaz y salidas | En curso: interfaz conectada al motor y al catálogo importado; emplazamiento con parcela rectangular; planos en PDF; faltan terreno (fase 6) y exportaciones Excel/JSON | Proyecto completo sin tocar código |
| 6. Terreno | Pendiente | 3 opciones coherentes con una parcela real |

## 10. Decisiones abiertas / datos a pedir a fabricantes

- Ángulo real de apertura y velocidad de viento de cierre (la fórmula 2·arcsen(recorrido / (2·hoja)) es una aproximación propia).
- Una hoja o mariposa: sugerir según zona climática, dejar elegir; mostrar coste y % cenital de ambas. También ventanas fijas con malla y techo cerrado (0 % cenital con aviso). Pedir precio de ventana con cremallera y de film enrollable en cubierta.
- Segunda ronda a fabricantes: ancho de hoja, recorrido de cremallera y punto de empuje, metros por motor, porosidad de la malla, separación entre pórticos, lista de perfiles con kg/m.
