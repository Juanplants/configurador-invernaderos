# Viento y nieve del sitio (CTE DB SE-AE)

El CTE no trae una tabla por municipio. La zona eólica (figura D.1) y la zona de clima invernal (figura E.2) solo vienen en mapas. Por eso, en el paso 2 (Emplazamiento) el usuario **elige la zona eólica (A, B o C) y la zona invernal (1 a 7)** consultando esas figuras, y escribe la **altitud**. Como atajo puede elegir una **capital de provincia** de la tabla 3.8, que da la altitud y la nieve.

Los datos no están en el código:

| Archivo | Qué es | Estado |
| --- | --- | --- |
| `datos/cte_se_ae.json` | Normativa: vb y qb por zona eólica (D.1), categorías de terreno (tabla D.2), sobrecarga de nieve por altitud y zona invernal (tabla E.2) y capitales (tabla 3.8) | Viento y categorías contrastados con el documento oficial. Tablas E.2 y 3.8 extraídas del PDF oficial (28-09-2026) |
| `datos/municipios_cte.csv` | Tabla de municipios **opcional**, por si algún día hay una fiable: da zona eólica, zona invernal y altitud de cada municipio | **Vacía** (solo la cabecera). Vacía no hace nada: el campo «Municipio» no aparece |
| `datos/municipios.js` | Generado a partir de los dos anteriores; no editar | 0 municipios |

Para regenerarlo:

```bash
node herramientas/municipios_a_js.js
```

Valida con el mismo código que la app (`js/sitio.js`). Si hay errores los lista con su fila y no escribe nada. Después, pasar `node tests/sitio.js`.

## Tabla E.2 en `cte_se_ae.json`

`nieve.tabla.altitudes` es la lista creciente de altitudes (m). `nieve.tabla.zonas["1"…"7"]` guarda sk en kN/m², un valor por altitud, y `null` donde la tabla no da dato.

## Cómo se usan los datos

- **Viento del sitio**: vb de la zona eólica en km/h (vb · 3,6). Se compara con el viento máximo declarado por el fabricante con el invernadero cerrado. El coeficiente de exposición ce, calculado con la categoría de terreno a la altura de cumbrera, y la presión qe = qb · ce se muestran como dato informativo.
- **Nieve del sitio**:
  - Con capital: sk de la tabla 3.8.
  - Si no: sk de la tabla E.2 por zona invernal y altitud, con interpolación lineal entre las altitudes con dato de la zona.
  - Por encima de la última altitud con dato de la zona: **«fuera de tabla, requiere estudio»**. No se compara y sale un aviso.
  - Se pasa a kg/m² (kN/m² · 1000 / 9,80665).
- **Comparación con el fabricante**:
  - Si el fabricante no declara nieve (vacío o 0), el resultado es «sin dato», con aviso.
  - El catálogo tiene la columna «Base del viento declarado» (velocidad media, ráfaga o presión kN/m²), para rellenarla cuando la den los fabricantes.
- **Resultado**: apto, al límite (a menos de un 10 % de lo declarado) o no apto. Es una comparación orientativa: no sustituye al cálculo estructural.

## Tabla de municipios (opcional)

Texto UTF-8, separado por `;` (vale también `,`), con cabecera:

```
codigo_ine;codigo_catastro;provincia;municipio;altitud_m;zona_eolica;zona_invierno
99001;99101;Provincia de ejemplo;Municipio de ejemplo;100;A;6
```

(Fila inventada, solo para mostrar el formato. Las líneas que empiezan por `#` se ignoran.)

| Columna | Contenido |
| --- | --- |
| `codigo_ine` | Provincia (2 cifras) + municipio (3) del INE |
| `codigo_catastro` | Provincia (2) + municipio **del Catastro** (3), el que va al principio de la referencia catastral de rústica. Con él, la parcela cargada rellena el municipio. Puede quedar vacío |
| `provincia`, `municipio` | Nombres para la lista |
| `altitud_m` | Altitud en metros |
| `zona_eolica` | `A`, `B` o `C` |
| `zona_invierno` | De `1` a `7` |

Con tabla, al elegir un municipio se rellenan la zona eólica, la zona invernal y la altitud. Cambiar después una zona o la altitud a mano deja de usar el municipio.
