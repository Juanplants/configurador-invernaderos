// Casos comunes de tests/planos.js y tests/planos_navegador.js:
// 1/2/5/10 naves × 10/20/60 tramos × los dos modelos del catálogo de ejemplo,
// en las cuatro hojas. Sección con techo cerrado, una hoja y mariposa;
// alzado lateral con y sin ventana lateral.

const HOJA = require('../js/planos/hoja.js');
const PLANTA = require('../js/planos/planta.js');
const TRANSVERSAL = require('../js/planos/transversal.js');
const LATERAL = require('../js/planos/lateral.js');
const GEO = require('../js/motor/geometria.js');
const catalogo = require('../datos/catalogo-ejemplo.json');

// Textos largos a propósito para forzar recortes en el cajetín
const PROYECTO = { cliente: 'Explotación Agrícola Hermanos Martínez Fernández', codigo: '26JD001', ubicacion: 'Paraje Los Llanos, El Ejido (Almería)' };
const FUNCION = { planta: PLANTA.planta, alzadoFrontal: TRANSVERSAL.alzadoFrontal, alzadoLateral: LATERAL.alzadoLateral, seccion: TRANSVERSAL.seccion };
const VENTANA = (lineas, g) => (lineas ? { lineas, hoja: g.ancho_hoja, rendija: Math.min(1, g.ancho_hoja) } : null);

function casos() {
  const lista = [];
  for (const modelo of catalogo.modelos) {
    for (const naves of [1, 2, 5, 10]) {
      for (const tramos of [10, 20, 60]) {
        const g = GEO.calcular(modelo, { naves, tramos });
        const base = { modelo, naves, tramos, g };
        const nombre = (vista, extra = '') => `${vista} ${modelo.id} ${naves} naves × ${tramos} tramos${extra}`;
        lista.push(Object.assign({ vista: 'planta', nombre: nombre('planta') }, base));
        lista.push(Object.assign({ vista: 'alzadoFrontal', nombre: nombre('alzado frontal') }, base));
        for (const alto of [0, 2]) {
          lista.push(Object.assign({ vista: 'alzadoLateral', nombre: nombre('alzado lateral', alto ? ', con ventana lateral' : ''),
            ventana: VENTANA(2, g), lateral: alto ? { alto } : null }, base));
        }
        for (const lineas of [0, 1, 2]) {
          lista.push(Object.assign({ vista: 'seccion', nombre: nombre('sección', [', techo cerrado', ', una hoja', ', mariposa'][lineas]),
            ventana: VENTANA(lineas, g) }, base));
        }
      }
    }
  }
  return lista;
}

function generar(caso) {
  return FUNCION[caso.vista]({
    g: caso.g, modelo: caso.modelo, empresa: catalogo.empresa, proyecto: PROYECTO, fecha: '28/09/2026',
    ventana: caso.ventana, lateral: caso.lateral
  });
}

module.exports = { casos, generar, letra: PLANTA.letra, HOJA };
