# Configurador de Invernaderos

Herramienta local (HTML + JavaScript, sin instalación) para diseñar invernaderos multitúnel, calcular su lista de materiales y generar planos y propuesta comercial a partir del catálogo de cada distribuidor.

- **v0.3** (actual interfaz): abrir `index.html`.
- **v0.4 en desarrollo**: el motor de cálculo nuevo está en `js/motor/`; se prueba abriendo `motor.html`.

Documentación:

- [`docs/ESPECIFICACION.md`](docs/ESPECIFICACION.md) — qué hace la herramienta y cómo
- [`docs/TRASPASO.md`](docs/TRASPASO.md) — estado actual, cómo probar y siguientes pasos
- [`docs/README_v0.3.md`](docs/README_v0.3.md) — README original de la v0.3

Pruebas del motor: `node tests/pruebas.js`

> Los precios y datos del catálogo de ejemplo son **estimados** y solo sirven para desarrollar. Cada distribuidor carga su propio catálogo.
