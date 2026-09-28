# Traspaso — estado del proyecto y cómo seguir

Para retomar el trabajo en otra conversación o con otra persona. Leer junto a `docs/ESPECIFICACION.md`.

## Contexto en tres líneas

- Juan David (agrónomo, Almería) rediseña su configurador v0.3 como herramienta para **distribuidores** de invernaderos multitúnel, con catálogo propio de cada distribuidor.
- En paralelo pide presupuestos a fabricantes chinos (RFQ de dos modelos de referencia: A = 3 naves × 8 m × 44 m, B = 6 naves × 9,6 m × 88 m, 4,5 m a canal, pórticos cada 4 m). Sus listas de materiales servirán para **calibrar** las reglas del catálogo.
- El trabajo se hace en español; los textos para proveedores en inglés.

## Qué hay en el repositorio

| Ruta | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `js/app.js`, `js/planos.js`, `js/propuesta.js` | Interfaz (base v0.3) **conectada al motor**: carga `datos/catalogo-ejemplo.js` y llama a `MOTOR.calcular` |
| `js/motor/` | **Motor de cálculo v0.4** (fase 2): expresiones, geometría, materiales, precios, avisos |
| `motor.html` | Página de prueba del motor con el catálogo de ejemplo (doble clic) |
| `datos/Catalogo_Plantilla_v0.4.xlsx` | Plantilla del catálogo, rellena con un **ejemplo de valores estimados** |
| `datos/catalogo-ejemplo.json` / `.js` | El mismo catálogo convertido (generado; no editar a mano) |
| `herramientas/catalogo_a_json.py` | Convierte la plantilla Excel en JSON/JS |
| `tests/referencia.py` | Implementación de referencia independiente en Python → `tests/esperado.json` |
| `tests/pruebas.js` | Pruebas del motor (144 comprobaciones) |
| `docs/` | Especificación, este traspaso, README de la v0.3 |

## Cómo comprobar que todo funciona

```bash
python3 herramientas/catalogo_a_json.py datos/Catalogo_Plantilla_v0.4.xlsx datos/catalogo-ejemplo.json
python3 tests/referencia.py
node tests/pruebas.js        # debe terminar con "0 fallos"
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

## Siguientes pasos (en orden)

1. **Fase 1 — importador en el navegador:** leer la plantilla `.xlsx` con una librería local en `lib/` (p. ej. SheetJS copiado, sin CDN) y validar referencias, reglas y precios antes de aceptar el catálogo.
2. ~~**Conectar el motor a la interfaz** de la v0.3~~ **Hecho** (2026-09-28): `calculos.js`, `modelos.js` y `opciones.js` retirados. Modelos, alturas/anchos/separaciones admitidos, opciones de envolvente (grupos de alternativas y opcionales), zonas de obra local, avisos, lista de materiales con «ver cálculo» y propuesta salen del catálogo y del motor. Los planos dibujan con la geometría del motor y rotulan los perfiles del catálogo. Pendiente: que la interfaz use el catálogo importado (paso 1) en vez del de ejemplo.
3. **Fase 3 — calibración** en cuanto llegue una lista de materiales estándar con pesos (CFGET y Ruineng la han prometido): volcarla en la plantilla y ajustar reglas hasta ≤ 5 % en acero total.
4. **Fase 4 — planos** según el apartado 6 de la especificación.

## Reglas de trabajo

- Ningún dato de producto en el código: todo en el catálogo.
- Valores estimados siempre marcados con `origen: estimado`.
- No subir al repositorio documentos de terceros (ofertas de otras empresas, presupuestos de montadores); sus cifras solo como referencia en el catálogo de ejemplo.
- Commits pequeños, mensajes en español.
