# Configurador de Invernaderos

Herramienta local (HTML + JavaScript, sin instalación) para diseñar invernaderos multitúnel, calcular su lista de materiales y generar planos y propuesta comercial a partir del catálogo de cada distribuidor.

- **Configurador**: abrir `index.html` (interfaz en 6 pasos conectada al motor de cálculo v0.4, con el plano siempre a la vista). Usa el catálogo de ejemplo o el del distribuidor con «Cargar catálogo». Con la parcela del Catastro (GML o KML) busca las 3 mejores implantaciones.
- **Motor de cálculo**: `js/motor/`; página de prueba aislada en `motor.html`.

Documentación:

- [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md) — qué hace la herramienta y cómo
- [`docs/TRASPASO.md`](docs/TRASPASO.md) — estado actual, cómo probar y siguientes pasos
- [`docs/README_v0.3.md`](docs/README_v0.3.md) — README original de la v0.3

Pruebas: `node tests/pruebas.js` (motor), `node tests/importacion.js` (importador del catálogo), `node tests/planos.js` (planos), `node tests/salidas.js` (proyecto, Excel y propuesta), `node tests/terreno.js` (parcela del Catastro y optimizador), `node tests/pasos.js` (flujo de 6 pasos), `node tests/sitio.js` (viento y nieve por municipio); con Playwright, además `tests/planos_navegador.js`, `tests/pdf_navegador.js`, `tests/salidas_navegador.js`, `tests/terreno_navegador.js`, `tests/pasos_navegador.js` y `tests/sitio_navegador.js`

> Los precios y datos del catálogo de ejemplo son **estimados** y solo sirven para desarrollar. Cada distribuidor carga su propio catálogo.
