// ============================================================
// Pruebas del motor de cálculo
// ============================================================
// Ejecutar:  node tests/pruebas.js
// Compara el motor (JavaScript) con la referencia independiente en Python
// (tests/esperado.json, generado por tests/referencia.py) y con los
// recuentos conocidos de la v0.3.

const MOTOR = require('../js/motor/motor.js');
const catalogo = require('../datos/catalogo-ejemplo.json');
const esperado = require('./esperado.json');

let fallos = 0, ok = 0;
const cerca = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
function comprobar(nombre, obtenido, esperadoV) {
  if (cerca(obtenido, esperadoV)) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}: motor ${obtenido} · referencia ${esperadoV}`);
}

const CASOS = {
  A_una_hoja:      { modelo: 'MT-GOT-80', naves: 3, tramos: 11, altura_canal: 4.5, puertas: 1, zona: 'Almería' },
  B_mariposa:      { modelo: 'MT-GOT-96', naves: 6, tramos: 22, altura_canal: 4.5, puertas: 2, zona: 'Almería',
                     seleccion: { ventilacion_cenital: 'C21' } },
  A_techo_cerrado: { modelo: 'MT-GOT-80', naves: 3, tramos: 11, altura_canal: 4.5, puertas: 1, zona: 'Almería',
                     seleccion: { ventilacion_cenital: null } }
};

for (const [nombre, proyecto] of Object.entries(CASOS)) {
  console.log(`Caso ${nombre}`);
  const r = MOTOR.calcular(catalogo, proyecto);
  const e = esperado[nombre];
  const ids = new Set([...r.lineas.map(l => l.id), ...e.lineas.map(l => l.id)]);
  for (const id of ids) {
    const lm = r.lineas.find(l => l.id === id);
    const le = e.lineas.find(l => l.id === id);
    if (!lm || !le) { fallos++; console.log(`  ✗ ${id}: falta en ${lm ? 'referencia' : 'motor'}`); continue; }
    comprobar(`${id} cantidad`, lm.cantidad, le.cantidad);
    comprobar(`${id} importe`, lm.importe, le.importe);
  }
  comprobar('materiales', r.precio.materiales, e.materiales);
  comprobar('obra local', r.precio.obra.total, e.obra);
  comprobar('base imponible', r.precio.base_imponible, e.base);
  comprobar('total con IVA', r.precio.total, e.total);
  comprobar('% ventilación cenital', r.ventilacion.pct_cenital, e.pct_cenital);
  comprobar('% ventilación total', r.ventilacion.pct_total, e.pct_total);
}

// Recuentos de la v0.3: 2 naves × 20 tramos de 2,5 m → 63 pilares y 42 cerchas
console.log('Caso v0.3 (63 pilares / 42 cerchas)');
{
  const cat = JSON.parse(JSON.stringify(catalogo));
  cat.modelos[1].separaciones_entre_porticos = '2.5';
  const r = MOTOR.calcular(cat, { modelo: 'MT-GOT-96', naves: 2, tramos: 20, separacion: 2.5, zona: 'Almería' });
  comprobar('pilares', r.geometria.pilares, 63);
  comprobar('cerchas (pórticos × naves)', r.geometria.porticos * r.geometria.naves, 42);
  comprobar('superficie', r.geometria.area, 960);
}

// Evaluador de expresiones: debe rechazar lo que no sea aritmética permitida
console.log('Evaluador de expresiones');
{
  const E = require('../js/motor/expresiones.js');
  comprobar('(4+2*ceil(11/5))*25', E.evaluar('(4+2*ceil(tramos/5))*k', { tramos: 11, k: 25 }), 250);
  for (const malo of ['process.exit()', 'naves;alert(1)', 'desconocida*2', '']) {
    try { E.evaluar(malo, { naves: 3 }); fallos++; console.log(`  ✗ aceptó "${malo}"`); }
    catch (_) { ok++; }
  }
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
