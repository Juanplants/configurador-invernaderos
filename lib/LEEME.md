# Librerías de terceros (copiadas, sin CDN)

La herramienta se abre con doble clic y sin internet, así que las librerías van aquí.

| Archivo | Qué es | Versión | Origen | Licencia |
| --- | --- | --- | --- | --- |
| `xlsx.mini.min.js` | SheetJS Community Edition, lectura de `.xlsx` | 0.18.5 | paquete npm `xlsx@0.18.5`, `dist/xlsx.mini.min.js` (integridad `sha512-dmg3LCjB…EtFQ==` comprobada contra el registro) | Apache 2.0 (`xlsx.LICENSE`) |

## Nota sobre la versión

SheetJS dejó de publicar en npm en la 0.18.5; las versiones nuevas (0.20.x) solo se descargan de `cdn.sheetjs.com`. La 0.18.5 tiene dos avisos de seguridad conocidos al leer archivos manipulados (CVE-2023-30533, contaminación de prototipo, corregido en 0.19.3; CVE-2024-22363, ReDoS, corregido en 0.20.2). Aquí el riesgo es bajo porque solo se leen catálogos que el propio distribuidor elige, pero conviene actualizar:

1. Descargar `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js`.
2. Sustituir `lib/xlsx.mini.min.js` y actualizar esta tabla.
3. Comprobar con `node tests/importacion.js` (debe terminar con «0 fallos»).

El importador (`js/importador.js`) solo usa `XLSX.read` y `XLSX.utils.decode_range` / `encode_cell`, que no cambian entre versiones.
