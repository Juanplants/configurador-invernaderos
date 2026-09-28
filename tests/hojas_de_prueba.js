// Casos comunes de tests/planos.js y tests/planos_navegador.js:
// 1/2/5/10 naves × 10/20/60 tramos × los dos modelos del catálogo de ejemplo,
// en las cuatro hojas (con una puerta de 3 × 3 m). Sección con techo cerrado,
// una hoja y mariposa; alzado lateral con y sin ventana lateral. Además, casos
// que fuerzan la interrupción (15 naves) y puertas en los dos hastiales.

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
  // Fuera de la malla: interrupción de alzados (15 naves) y puertas en los dos hastiales
  for (const modelo of catalogo.modelos) {
    const g15 = GEO.calcular(modelo, { naves: 15, tramos: 20 });
    lista.push({ vista: 'alzadoFrontal', nombre: `alzado frontal ${modelo.id} 15 naves (interrumpido)`, modelo, naves: 15, tramos: 20, g: g15 });
    lista.push({ vista: 'seccion', nombre: `sección ${modelo.id} 15 naves (interrumpida)`, modelo, naves: 15, tramos: 20, g: g15, ventana: VENTANA(2, g15) });
    const g2 = GEO.calcular(modelo, { naves: 2, tramos: 20 });
    lista.push({ vista: 'planta', nombre: `planta ${modelo.id} 2 naves con 3 puertas`, modelo, naves: 2, tramos: 20, g: g2, puertas: PUERTAS(3) });
    lista.push({ vista: 'alzadoFrontal', nombre: `alzado frontal ${modelo.id} 2 naves con 3 puertas`, modelo, naves: 2, tramos: 20, g: g2, puertas: PUERTAS(3) });
  }
  return lista;
}

// Puerta del catálogo de ejemplo (3 × 3 m), una por proyecto como en la app por defecto
const PUERTA = catalogo.equipos.find(e => e.tipo === 'puerta');
const PUERTAS = (cantidad) => ({ cantidad, ancho: PUERTA.ancho_puerta, alto: PUERTA.alto_puerta });

function datos(caso) {
  return {
    g: caso.g, modelo: caso.modelo, empresa: catalogo.empresa, proyecto: PROYECTO, fecha: '28/09/2026',
    ventana: caso.ventana, lateral: caso.lateral, puertas: caso.puertas === undefined ? PUERTAS(1) : caso.puertas
  };
}
const generar = (caso) => FUNCION[caso.vista](datos(caso));

module.exports = { casos, generar, datos, PUERTAS, letra: PLANTA.letra, HOJA, PLANTA, TRANSVERSAL, LATERAL, GEO, catalogo };
