# Viento y nieve por municipio (CTE DB SE-AE)

La app rellena el viento y la nieve del sitio a partir del municipio (paso 2, Emplazamiento). Los datos no están en el código. Van en dos archivos que `herramientas/municipios_a_js.js` junta en `datos/municipios.js`, el que carga la app sin internet.

| Archivo | Qué es | Estado |
| --- | --- | --- |
| `datos/cte_se_ae.json` | Normativa: velocidad básica del viento por zona eólica (anejo D.1), categorías de terreno (tabla D.2) y sobrecarga de nieve por zona de invierno y altitud (tabla E.2) | Viento y categorías **transcritos a mano, pendientes de contrastar** con el documento oficial. Tabla E.2 **vacía, pendiente** |
| `datos/municipios_cte.csv` | Un municipio por fila | **Vacía**: solo la cabecera |
| `datos/municipios.js` | Generado; no editar | 0 municipios |

Mientras la tabla esté vacía, el paso 2 pide el viento y la nieve a mano, como hasta ahora.

## `municipios_cte.csv`

Texto UTF-8, separado por `;` (vale también `,`), con esta cabecera:

```
codigo_ine;codigo_catastro;provincia;municipio;altitud_m;zona_eolica;zona_invierno
99001;99101;Provincia de ejemplo;Municipio de ejemplo;100;A;6
```

(Fila inventada, solo para mostrar el formato.)

| Columna | Contenido |
| --- | --- |
| `codigo_ine` | Código INE del municipio: provincia (2 cifras) + municipio (3), por ejemplo `04013` |
| `codigo_catastro` | Provincia (2) + municipio **del Catastro** (3). Es el que va al principio de la referencia catastral de rústica (20 caracteres) y permite sacar el municipio de la parcela cargada. Puede quedar vacío |
| `provincia`, `municipio` | Nombres como se quieran ver en la lista |
| `altitud_m` | Altitud del núcleo en metros (para la nieve) |
| `zona_eolica` | `A`, `B` o `C` (figura D.1) |
| `zona_invierno` | Zona climática de invierno, de `1` a `7` (figura E.2) |

Las líneas que empiezan por `#` se ignoran.

## `cte_se_ae.json` → tabla E.2 de nieve

Hay que rellenar `nieve.tabla`:

- `altitudes`: lista creciente de altitudes en m, una por fila de la tabla E.2.
- `zonas`: para cada zona de `1` a `7`, los valores de sk en kN/m², en el mismo orden y con el mismo número de valores que `altitudes`.

Entre filas se interpola linealmente.

## Generar `datos/municipios.js`

```bash
node herramientas/municipios_a_js.js
```

Valida con el mismo código que la app (`js/sitio.js`). Si hay errores los lista con su fila y no escribe nada. Después, pasar las pruebas (`node tests/sitio.js`).

## Cómo se usan los datos

- **Viento del sitio**: vb de la zona eólica en km/h (vb · 3,6). Se compara con el viento máximo declarado por el fabricante con el invernadero cerrado. El coeficiente de exposición ce, calculado con la categoría de terreno a la altura de cumbrera, y la presión qe = qb · ce se muestran como dato informativo.
- **Nieve del sitio**: sk de la tabla E.2 en kg/m² (kN/m² · 1000 / 9,80665). Se compara con la nieve declarada. Si el fabricante no declara nieve (vacío o 0), el resultado es «sin dato» y sale un aviso.
- **Resultado**: apto, al límite (a menos de un 10 % de lo declarado) o no apto. Es una comparación orientativa: no sustituye al cálculo estructural.
