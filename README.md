# Configurador de Invernaderos

Herramienta local (HTML + JavaScript, sin instalación) para diseñar invernaderos multitúnel, calcular su lista de materiales y generar planos y propuesta comercial a partir del catálogo de cada distribuidor.

- **Configurador**: abrir `index.html` (interfaz de la v0.3 conectada al motor de cálculo v0.4). Usa el catálogo de ejemplo o el del distribuidor con «Cargar catálogo».
- **Motor de cálculo**: `js/motor/`; página de prueba aislada en `motor.html`.

Documentación:

- [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md) — qué hace la herramienta y cómo
- [`docs/TRASPASO.md`](docs/TRASPASO.md) — estado actual, cómo probar y siguientes pasos
- [`docs/README_v0.3.md`](docs/README_v0.3.md) — README original de la v0.3

Pruebas: `node tests/pruebas.js` (motor) y `node tests/importacion.js` (importador del catálogo)

> Los precios y datos del catálogo de ejemplo son **estimados** y solo sirven para desarrollar. Cada distribuidor carga su propio catálogo.
