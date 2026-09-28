// ============================================================
// Motor de cálculo — punto de entrada
// ============================================================
// resultado = MOTOR.calcular(catalogo, proyecto)
//
// proyecto = {
//   modelo: 'MT-GOT-80', naves: 3, tramos: 11,
//   altura_canal: 4.5,               // opcional (primera admitida por defecto)
//   separacion: 4, ancho_nave: 8,    // opcionales
//   puertas: 1,
//   seleccion: { ventilacion_cenital: 'C21', ventilacion_lateral: 'C23' }, // null = ninguna
//   opcionales: [],                  // ids de componentes opcionales sin grupo
//   zona: 'Almería',                 // fila de la hoja Obra local
//   sitio: { viento_kmh: 90, nieve: 0 } // opcional, para la aptitud
// }
//
// El motor no toca la pantalla: recibe datos y devuelve resultados.

(function (raiz) {
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const M = raiz.MOTOR || {};
  const GEO = M.geometria || req('./geometria.js');
  const MAT = M.materiales || req('./materiales.js');
  const PRE = M.precios || req('./precios.js');
  const AVI = M.avisos || req('./avisos.js');

  function ventanaElegida(catalogo, modelo, proyecto, grupo) {
    const { elegidos } = MAT.componentesActivos(catalogo, modelo, proyecto);
    const compId = elegidos[grupo];
    if (!compId) return null;
    const comp = catalogo.componentes.find(c => c.id === compId);
    const idx = String(comp.modelos).split(';').map(s => s.trim()).indexOf(modelo.id);
    const ref = MAT.buscar(catalogo, MAT.variante(comp.ref, idx));
    return ref && ref.hoja === 'equipos' ? ref.fila : null;
  }

  function calcular(catalogo, proyecto) {
    const modelo = catalogo.modelos.find(m => m.id === proyecto.modelo);
    if (!modelo) throw new Error(`Modelo "${proyecto.modelo}" no está en el catálogo`);

    const g = GEO.calcular(modelo, proyecto);
    const cenital = ventanaElegida(catalogo, modelo, proyecto, 'ventilacion_cenital');
    const lateral = ventanaElegida(catalogo, modelo, proyecto, 'ventilacion_lateral');
    const malla = (catalogo.cubiertas || []).find(c => c.tipo === 'malla') || null;
    const vent = GEO.ventilacion(g, cenital, lateral, malla);

    const apto = AVI.emplazamiento(modelo, proyecto.sitio);
    const { lineas, errores } = MAT.calcular(catalogo, modelo, proyecto, g, vent);
    const precio = PRE.calcular(catalogo, proyecto, g, lineas);
    const avisos = AVI.generar({ modelo, proyecto, g, vent, lineas, apto, errores });

    return { modelo: { id: modelo.id, nombre: modelo.nombre }, geometria: g, ventilacion: vent,
             emplazamiento: apto, lineas, precio, avisos };
  }

  const API = { calcular };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
