// Casos comunes de tests/planos.js y tests/planos_navegador.js:
// 1/2/5/10 naves × 10/20/60 tramos × los dos modelos del catálogo de ejemplo,
// en las cinco hojas (con una puerta de 3 × 3 m). Sección con techo cerrado,
// una hoja y mariposa; alzado lateral con y sin ventana lateral. Además, casos
// que fuerzan la interrupción (15 naves) y puertas en los dos hastiales.
// Emplazamiento también sobre parcelas reales (polígono): la de ejemplo del
// Catastro (inventada, tests/datos/parcela_irregular.gml) y una con un hueco.

const HOJA = require('../js/planos/hoja.js');
const PLANTA = require('../js/planos/planta.js');
const TRANSVERSAL = require('../js/planos/transversal.js');
const LATERAL = require('../js/planos/lateral.js');
const EMPLAZAMIENTO = require('../js/planos/emplazamiento.js');
const GEO = require('../js/motor/geometria.js');
const PARCELA = require('../js/terreno/parcela.js');
const OPTIMIZADOR = require('../js/terreno/optimizador.js');
const catalogo = require('../datos/catalogo-ejemplo.json');
const fs = require('fs');
const path = require('path');

// Textos largos a propósito para forzar recortes en el cajetín
const PROYECTO = { cliente: 'Explotación Agrícola Hermanos Martínez Fernández', codigo: '26JD001', ubicacion: 'Paraje Los Llanos, El Ejido (Almería)' };
const FUNCION = { planta: PLANTA.planta, alzadoFrontal: TRANSVERSAL.alzadoFrontal, alzadoLateral: LATERAL.alzadoLateral, seccion: TRANSVERSAL.seccion, emplazamiento: EMPLAZAMIENTO.emplazamiento };
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
        // Emplazamiento: parcela con 12 m de margen a lo largo y 8 m a lo ancho, a 30° del norte
        lista.push(Object.assign({ vista: 'emplazamiento', nombre: nombre('emplazamiento'),
          parcela: { largo: g.largo + 24, ancho: g.ancho_total + 16, orientacion: 30 } }, base));
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
  // Emplazamiento fuera de la malla: girado, parcela más ancha que larga, pegado al lindero y sin sitio
  for (const modelo of catalogo.modelos) {
    const g = GEO.calcular(modelo, { naves: 5, tramos: 20 });
    const b = { vista: 'emplazamiento', modelo, naves: 5, tramos: 20, g };
    const n = (t) => `emplazamiento ${modelo.id} 5 naves × 20 tramos, ${t}`;
    lista.push(Object.assign({ nombre: n('girado 90°'), parcela: { largo: g.ancho_total + 30, ancho: g.largo + 10, orientacion: 75, girado: true } }, b));
    lista.push(Object.assign({ nombre: n('parcela más ancha que larga'), parcela: { largo: g.largo + 10, ancho: g.largo + 60, orientacion: 350 } }, b));
    lista.push(Object.assign({ nombre: n('pegado al lindero'), parcela: { largo: g.largo, ancho: g.ancho_total + 20, orientacion: 0 } }, b));
    lista.push(Object.assign({ nombre: n('no cabe'), parcela: { largo: g.largo - 12, ancho: g.ancho_total + 6, orientacion: 120 } }, b));
  }
  // Emplazamiento sobre polígono: invernadero colocado por el optimizador (encajar)
  const ejemplo = PARCELA.leer(fs.readFileSync(path.join(__dirname, 'datos', 'parcela_irregular.gml'), 'utf8'), 'parcela_irregular.gml');
  const conHueco = parcelaConHueco();
  const poligono = (nombre, modelo, naves, tramos, parcela, { retranqueo = 3, camino = 4, mover = null } = {}) => {
    const g = GEO.calcular(modelo, { naves, tramos });
    let implantacion = OPTIMIZADOR.encajar(parcela.anillos, g.largo, g.ancho_total, Math.max(retranqueo, camino));
    if (mover) implantacion = OPTIMIZADOR.encajar(parcela.anillos, g.largo, g.ancho_total, 0);
    const terreno = { anillos: parcela.anillos, meta: parcela.meta, implantacion, retranqueo: mover ? mover : retranqueo, camino };
    lista.push({ vista: 'emplazamiento', nombre: `emplazamiento ${modelo.id} ${naves} naves × ${tramos} tramos, ${nombre}`, modelo, naves, tramos, g, terreno });
  };
  for (const modelo of catalogo.modelos) {
    poligono('parcela del Catastro', modelo, 5, 20, ejemplo);
    poligono('parcela del Catastro, sin camino', modelo, 2, 10, ejemplo, { camino: 0 });
    poligono('parcela con hueco', modelo, 4, 15, conHueco);
    poligono('parcela del Catastro, no cabe', modelo, 20, 60, ejemplo);
  }
  const m96 = catalogo.modelos.find(m => m.id === 'MT-GOT-96');
  poligono('parcela del Catastro, grande', m96, 10, 30, ejemplo);
  poligono('parcela del Catastro, no cumple el retranqueo', m96, 10, 30, ejemplo, { mover: 60 });
  return lista;
}

// Parcela inventada con un hueco (p. ej. una balsa ajena): 260 × 180 m girada 25°
function parcelaConHueco() {
  const [ext] = PARCELA.rectangulo(260, 180, 25);
  const hueco = PARCELA.esquinas({ cx: 70, cy: 20, azimut: 25, largo: 40, ancho: 30 }).reverse();
  return { anillos: [ext, hueco], meta: { formato: 'prueba', archivo: 'parcela_con_hueco (inventada)' } };
}

// Puerta del catálogo de ejemplo (3 × 3 m), una por proyecto como en la app por defecto
const PUERTA = catalogo.equipos.find(e => e.tipo === 'puerta');
const PUERTAS = (cantidad) => ({ cantidad, ancho: PUERTA.ancho_puerta, alto: PUERTA.alto_puerta });

function datos(caso) {
  return {
    g: caso.g, modelo: caso.modelo, empresa: catalogo.empresa, proyecto: PROYECTO, fecha: '28/09/2026',
    ventana: caso.ventana, lateral: caso.lateral, puertas: caso.puertas === undefined ? PUERTAS(1) : caso.puertas,
    parcela: caso.parcela, terreno: caso.terreno
  };
}
const generar = (caso) => FUNCION[caso.vista](datos(caso));

module.exports = { casos, parcelaConHueco, PARCELA, OPTIMIZADOR, generar, datos, PUERTAS, letra: PLANTA.letra, HOJA, PLANTA, TRANSVERSAL, LATERAL, EMPLAZAMIENTO, GEO, catalogo };
