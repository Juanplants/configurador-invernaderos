// ============================================================
// Pruebas de la hoja de planta (fase 4)
// ============================================================
// Ejecutar:  node tests/planos.js
// Aceptación: cero solapes en 1/2/5/10 naves × 10/20/60 tramos, en los
// dos modelos del catálogo de ejemplo. Además: todo dentro del marco,
// escala normalizada, la mayor que cabe, y dibujo a escala real.
// (tests/planos_navegador.js comprueba en Chromium que los textos reales
// caben en las cajas estimadas.)

const HOJA = require('../js/planos/hoja.js');
const PLANTA = require('../js/planos/planta.js');
const GEO = require('../js/motor/geometria.js');
const catalogo = require('../datos/catalogo-ejemplo.json');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}

// Cajas de texto (y burbujas): no pueden pisar nada. Las líneas entre sí sí
// pueden tocarse (una línea de referencia sale del borde del dibujo).
const TEXTOS = new Set(['cota', 'eje', 'cajetin', 'leyenda', 'escala']);
const PROYECTO = { cliente: 'Explotación Agrícola Hermanos Martínez Fernández', codigo: '26JD001', ubicacion: 'Paraje Los Llanos, El Ejido (Almería)' };

const CASOS = [];
for (const modelo of catalogo.modelos) {
  for (const naves of [1, 2, 5, 10]) {
    for (const tramos of [10, 20, 60]) CASOS.push({ modelo, naves, tramos });
  }
}

for (const { modelo, naves, tramos } of CASOS) {
  const nombre = `${modelo.id} ${naves} naves × ${tramos} tramos`;
  const g = GEO.calcular(modelo, { naves, tramos });
  const h = PLANTA.planta({ g, modelo, empresa: catalogo.empresa, proyecto: PROYECTO, fecha: '28/09/2026' });
  const errores = [];

  if (h.fallos.length) errores.push(`textos sin sitio: ${h.fallos.join('; ')}`);

  // Cero solapes
  const cajas = h.cajas;
  for (let i = 0; i < cajas.length; i++) {
    if (!TEXTOS.has(cajas[i].tipo)) continue;
    for (let j = 0; j < cajas.length; j++) {
      if (i !== j && HOJA.solapan(cajas[i], cajas[j])) {
        errores.push(`solape: ${cajas[i].tipo} "${cajas[i].nombre}" con ${cajas[j].tipo} "${cajas[j].nombre || ''}"`);
      }
    }
  }
  // Dentro del marco; lo del dibujo, fuera de la banda de leyenda y cajetín
  for (const c of cajas) {
    if (!HOJA.dentro(c, HOJA.MARCO)) errores.push(`fuera del marco: ${c.tipo} "${c.nombre || ''}"`);
    if (['cota', 'eje', 'dibujo', 'linea_cota', 'referencia'].includes(c.tipo) && !HOJA.dentro(c, HOJA.DIBUJO)) {
      errores.push(`${c.tipo} "${c.nombre || ''}" invade la leyenda o el cajetín`);
    }
  }

  // Escala normalizada, la mayor que cabe, y real
  const E = h.escala;
  const d = h.dibujo;
  if (!HOJA.ESCALAS.includes(E) || E < 20 || E > 1000) errores.push(`escala 1:${E} fuera de 1:20…1:1000`);
  const mayor = HOJA.ESCALAS[HOJA.ESCALAS.indexOf(E) - 1];
  if (mayor) {
    const cabe = (a, b) => a * 1000 / mayor <= d.disponible.w && b * 1000 / mayor <= d.disponible.h;
    if (cabe(g.largo, g.ancho_total) || cabe(g.ancho_total, g.largo)) errores.push(`cabría a 1:${mayor}`);
  }
  const [enX, enY] = d.largoEnX ? [g.largo, g.ancho_total] : [g.ancho_total, g.largo];
  if (Math.abs(d.w - enX * 1000 / E) > 1e-6 || Math.abs(d.h - enY * 1000 / E) > 1e-6) errores.push('el dibujo no está a la escala del cajetín');
  if (!h.svg.includes(`>1:${E}<`)) errores.push('el cajetín no muestra la escala');

  // Ejes: primero y último de cada dirección siempre rotulados
  const ejes = new Set(cajas.filter(c => c.tipo === 'eje').map(c => c.nombre));
  for (const e of ['1', String(g.porticos), 'A', PLANTA.letra(naves)]) {
    if (!ejes.has(e)) errores.push(`falta la burbuja del eje ${e}`);
  }
  // Cotas totales presentes
  const cotas = cajas.filter(c => c.tipo === 'cota').map(c => c.nombre);
  for (const t of [HOJA.fmtCota(g.largo), HOJA.fmtCota(g.ancho_total)]) {
    if (!cotas.some(c => c.endsWith(` ${t}`) && c.includes('total'))) errores.push(`falta la cota total ${t}`);
  }

  comprobar(`${nombre} (1:${E}, ${cajas.filter(c => TEXTOS.has(c.tipo)).length} textos)`, errores.length === 0, '\n      ' + errores.slice(0, 8).join('\n      '));
}

// Registro: un texto obligatorio que no cabe queda anotado como fallo
{
  const reg = new HOJA.Registro();
  reg.ocupar({ x: 0, y: 0, w: 100, h: 100 }, 'dibujo');
  const r = reg.colocar([{ caja: { x: 10, y: 10, w: 5, h: 5 } }], { tipo: 'cota', nombre: 'prueba' });
  comprobar('el registro rechaza un texto encima de otro y lo apunta como fallo', r === null && reg.fallos.length === 1);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
