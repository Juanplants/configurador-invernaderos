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
| `js/planos/planta.js`, `transversal.js`, `lateral.js` | Hojas 01 planta, 02 alzado frontal, 03 alzado lateral, 04 sección transversal |
| `js/importador.js` | **Importador y validador del catálogo** (fase 1): lee la plantilla `.xlsx` en el navegador |
| `lib/` | Librerías copiadas para funcionar sin internet: SheetJS 0.18.5 (ver `lib/LEEME.md`) |
| `js/motor/` | **Motor de cálculo v0.4** (fase 2): expresiones, geometría, materiales, precios, avisos |
| `motor.html` | Página de prueba del motor con el catálogo de ejemplo (doble clic) |
| `datos/Catalogo_Plantilla_v0.4.xlsx` | Plantilla del catálogo, rellena con un **ejemplo de valores estimados** |
| `datos/catalogo-ejemplo.json` / `.js` | El mismo catálogo convertido (generado; no editar a mano) |
| `herramientas/catalogo_a_json.py` | Convierte la plantilla Excel en JSON/JS (misma conversión que `js/importador.js`) |
| `tests/referencia.py` | Implementación de referencia independiente en Python → `tests/esperado.json` |
| `tests/pruebas.js` | Pruebas del motor (147 comprobaciones) |
| `tests/importacion.js` | Pruebas del importador (32): plantilla correcta sin errores e igual al JSON de Python; copia con errores provocados |
| `tests/planos.js` | Pruebas de las cuatro hojas (184 comprobaciones, 176 hojas): cero solapes en 1/2/5/10 naves × 10/20/60 tramos, dibujo ≥ 50 % del espacio, escala de la serie y la mayor que vale, lado largo horizontal, alzados enteros o interrumpidos según la regla, puertas; en la sección, arco, alturas y ventana cenital |
| `tests/hojas_de_prueba.js` | Casos comunes a las dos pruebas de planos (168 hojas) |
| `tests/planos_navegador.js` | En Chromium, cada texto real cabe en su caja estimada (se omite sin Playwright) |
| `tests/generar_catalogo_con_errores.py` → `tests/datos/Catalogo_con_errores.xlsx` | Plantilla con 6 errores y 3 avisos provocados a propósito |
| `docs/` | Especificación, este traspaso, README de la v0.3 |

## Cómo comprobar que todo funciona

```bash
python3 herramientas/catalogo_a_json.py datos/Catalogo_Plantilla_v0.4.xlsx datos/catalogo-ejemplo.json
python3 tests/referencia.py
node tests/pruebas.js        # debe terminar con "0 fallos"
node tests/importacion.js    # ídem (si se cambia la plantilla: python3 tests/generar_catalogo_con_errores.py)
node tests/planos.js
node tests/planos_navegador.js   # opcional, necesita Playwright
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
- **Hojas hechas:** 01 planta, 02 alzado frontal, 03 alzado lateral, 04 sección transversal.
- **Sección y alzado frontal:** arco dibujado como la parábola de luz = ancho de nave y flecha del catálogo (la misma forma con la que el motor calcula longitud de arco y volumen). Alturas a canal, flecha y cumbrera acotadas. Si el invernadero entero cabe a 1:300 o mayor, se dibuja completo; si no, se interrumpe a la mayor escala en la que quepan al menos 2 naves, con tantas como llenen el ancho (p. ej. 15 naves de 9,60 m: 3 naves a 1:100). La cota de la interrupción dice cuántas naves faltan y la total es la real.
- **Puertas:** medidas de la hoja Equipos («Ancho puerta», «Alto puerta»); cantidad de la partida de puertas. Una por nave en el hastial frontal y el resto en el trasero, en el hueco entre pilares de hastial más centrado de la nave. Se dibujan en planta (hoja corredera por fuera del hastial) y en el alzado frontal.
- **Ventana cenital en la sección:** según la opción elegida (1 línea = una hoja, 2 = mariposa, ninguna = techo cerrado), con bisagra en la cumbrera, hoja cerrada sobre el arco y abierta a 2·arcsen(rendija / 2·hoja). Los datos salen del resultado del motor (`r.ventilacion`), así coinciden con la lista de materiales. Rótulo obligatorio con línea de referencia.
- **Alzado lateral:** ventana cenital del 2.º al penúltimo pórtico (`long_ventana_cenital`) y ventana lateral si la hay (posición orientativa). Sus rótulos son opcionales: con 60 tramos a 1:1000 las burbujas no dejan paso; el dato va siempre en las notas.
- Pendiente: emplazamiento con el norte, detalles, cimentación; exportar PDF por hoja. El norte no se dibuja hasta tener la orientación de la parcela.

## Siguientes pasos (en orden)

1. ~~**Fase 1 — importador en el navegador**~~ **Hecho** (2026-09-28): ver «Cargar un catálogo». Pendiente menor: actualizar SheetJS a 0.20.3 cuando se pueda descargar de `cdn.sheetjs.com` (instrucciones en `lib/LEEME.md`).
2. ~~**Conectar el motor a la interfaz** de la v0.3~~ **Hecho** (2026-09-28): `calculos.js`, `modelos.js` y `opciones.js` retirados. Modelos, alturas/anchos/separaciones admitidos, opciones de envolvente (grupos de alternativas y opcionales), zonas de obra local, avisos, lista de materiales con «ver cálculo» y propuesta salen del catálogo y del motor. Los planos dibujan con la geometría del motor y rotulan los perfiles del catálogo.
3. **Fase 3 — calibración** en cuanto llegue una lista de materiales estándar con pesos (CFGET y Ruineng la han prometido): volcarla en la plantilla y ajustar reglas hasta ≤ 5 % en acero total.
4. **Fase 4 — planos** según el apartado 6 de la especificación: planta, alzados y sección hechos (ver «Planos»); siguen detalles, cimentación, emplazamiento y exportación por hoja.

## Reglas de trabajo

- Ningún dato de producto en el código: todo en el catálogo.
- Valores estimados siempre marcados con `origen: estimado`.
- No subir al repositorio documentos de terceros (ofertas de otras empresas, presupuestos de montadores); sus cifras solo como referencia en el catálogo de ejemplo.
- Commits pequeños, mensajes en español.
