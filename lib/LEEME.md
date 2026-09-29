# Librerías de terceros (copiadas, sin CDN)

La herramienta se abre con doble clic y sin internet, así que las librerías van aquí.

| Archivo | Qué es | Versión | Origen | Licencia |
| --- | --- | --- | --- | --- |
| `xlsx.mini.min.js` | SheetJS Community Edition, lectura y escritura de `.xlsx` | 0.20.3 | `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js`, traído por el usuario (29-09-2026; desde el entorno en la nube no se llega al CDN). Huella `sha512-gWfIvFPOGSEkpFHV+XsZdhKZgTTbEkH0w5f3C04hdGlLQK38nc4sVrvWUAuqY3Smk17035PTsZ/voVEghCHcLA==` | Apache 2.0 (`xlsx.LICENSE`) |
| `jspdf.umd.min.js` | jsPDF, generación de PDF | 4.2.1 | paquete npm `jspdf@4.2.1`, `dist/jspdf.umd.min.js` (integridad `sha512-YyAXyvnm…6HIlQ==` comprobada contra el registro) | MIT (`jspdf.LICENSE`) |
| `svg2pdf.umd.min.js` | svg2pdf.js, convierte los planos SVG en PDF vectorial | 2.8.1 | paquete npm `svg2pdf.js@2.8.1`, `dist/svg2pdf.umd.min.js` (integridad `sha512-AzXfPHjH…8udfNQ==` comprobada contra el registro) | MIT (`svg2pdf.LICENSE`) |

## Notas sobre el PDF

- Las hojas se escriben con las fuentes estándar del PDF (Helvetica): no hace falta incrustar fuentes, pero solo admiten el juego WinAnsi (cp1252). Por eso `HOJA.aWinAnsi` normaliza todos los textos de los planos (≈ → «aprox.», etc.).
- jsPDF solo carga `html2canvas`, `dompurify` y `canvg` si se usa `doc.html()`; la herramienta no lo usa, así que no se copian.
- Comprobación: `node tests/pdf_navegador.js` (descarga los PDF en Chromium sin conexión y mide la escala).

## Nota sobre la versión

SheetJS dejó de publicar en npm en la 0.18.5; las versiones nuevas solo se descargan de `cdn.sheetjs.com`. Desde el 29-09-2026 se usa la **0.20.3**, que corrige los dos avisos de seguridad de la 0.18.5 al leer archivos manipulados (CVE-2023-30533, contaminación de prototipo, corregido en 0.19.3; CVE-2024-22363, ReDoS, corregido en 0.20.2). Se cambió con `herramientas/cambiar_sheetjs.js`, que pasó las pruebas de importación, Excel, propuesta y catálogo en node y en Chromium.

Para cambiar a otra versión más adelante:

1. Descargar el `xlsx.mini.min.js` de la versión de `cdn.sheetjs.com` (desde el entorno de desarrollo en la nube no se llega al CDN; hay que traerlo de fuera).
2. `node herramientas/cambiar_sheetjs.js ruta/al/xlsx.mini.min.js`. Muestra la versión y la huella sha512 y pasa, con el archivo nuevo y sin tocar `lib/`, las pruebas en node que usan SheetJS (`importacion`, `salidas`, `sitio`). Si pasan, lo copia a `lib/` y pasa las de Chromium que leen y escriben Excel en la app (`salidas_navegador`, `pasos_navegador`). Si algo falla, deja la versión anterior.
3. Actualizar la fila de esta tabla con la versión, el origen y la huella.

Para probar otra versión a mano sin cambiarla: `XLSX_LIB=ruta/al/archivo.js node tests/importacion.js` (igual con `salidas.js` y `sitio.js`).

El importador (`js/importador.js`) solo usa `XLSX.read` y `XLSX.utils.decode_range` / `encode_cell`; el Excel de materiales (`js/excel.js`), `XLSX.utils.book_new` / `aoa_to_sheet` / `book_append_sheet` / `encode_cell` / `encode_range` y `XLSX.writeFile`. Ninguna cambia entre la 0.18 y la 0.20.
