// ============================================================
// Pruebas de las hojas de planos (fase 4)
// ============================================================
// Ejecutar:  node tests/planos.js
// Aceptación: cero solapes en 1/2/5/10 naves × 10/20/60 tramos, en los
// dos modelos del catálogo de ejemplo, para planta, alzado frontal, alzado
// lateral y sección (esta con techo cerrado, una hoja y mariposa). Además:
// todo dentro del marco, escala normalizada, la mayor que cabe y real, y en
// la sección el arco, las alturas y la ventana cenital del catálogo.
// (tests/planos_navegador.js comprueba en Chromium que los textos reales
// caben en las cajas estimadas.)

const HOJA = require('../js/planos/hoja.js');
const HOJAS = require('./hojas_de_prueba.js');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}

// Cajas de texto (y burbujas): no pueden pisar nada. Las líneas entre sí sí
// pueden tocarse (una línea de referencia sale del borde del dibujo).
const TEXTOS = new Set(['cota', 'eje', 'cajetin', 'leyenda', 'escala', 'rotulo']);
const EN_DIBUJO = new Set(['cota', 'eje', 'rotulo', 'dibujo', 'linea_cota', 'referencia']);
const fmt = HOJA.fmtCota;
const recuento = {};

function comunes(h, errores) {
  if (h.fallos.length) errores.push(`textos sin sitio: ${h.fallos.join('; ')}`);
  const cajas = h.cajas;
  for (let i = 0; i < cajas.length; i++) {
    if (!TEXTOS.has(cajas[i].tipo)) continue;
    for (let j = 0; j < cajas.length; j++) {
      if (i !== j && HOJA.solapan(cajas[i], cajas[j])) {
        errores.push(`solape: ${cajas[i].tipo} "${cajas[i].nombre}" con ${cajas[j].tipo} "${cajas[j].nombre || ''}"`);
      }
    }
  }
  for (const c of cajas) {
    if (!HOJA.dentro(c, HOJA.MARCO)) errores.push(`fuera del marco: ${c.tipo} "${c.nombre || ''}"`);
    if (EN_DIBUJO.has(c.tipo) && !HOJA.dentro(c, HOJA.DIBUJO)) errores.push(`${c.tipo} "${c.nombre || ''}" invade la leyenda o el cajetín`);
  }
  if (!HOJA.ESCALAS.includes(h.escala) || h.escala < 20 || h.escala > 1000) errores.push(`escala 1:${h.escala} fuera de 1:20…1:1000`);
  if (!h.svg.includes(`>1:${h.escala}<`)) errores.push('el cajetín no muestra la escala');
}
const mayorQue = (E) => HOJA.ESCALAS[HOJA.ESCALAS.indexOf(E) - 1];
const casi = (a, b) => Math.abs(a - b) < 1e-6;
const cotas = (h) => h.cajas.filter(c => c.tipo === 'cota').map(c => c.nombre);
const ejes = (h) => new Set(h.cajas.filter(c => c.tipo === 'eje').map(c => c.nombre));

// ---------- Planta ----------
function planta(h, { g, naves }, errores) {
  const d = h.dibujo, E = h.escala, mayor = mayorQue(E);
  if (mayor) {
    const cabe = (a, b) => a * 1000 / mayor <= d.disponible.w && b * 1000 / mayor <= d.disponible.h;
    if (cabe(g.largo, g.ancho_total) || cabe(g.ancho_total, g.largo)) errores.push(`cabría a 1:${mayor}`);
  }
  const [enX, enY] = d.largoEnX ? [g.largo, g.ancho_total] : [g.ancho_total, g.largo];
  if (!casi(d.w, enX * 1000 / E) || !casi(d.h, enY * 1000 / E)) errores.push('el dibujo no está a la escala del cajetín');
  for (const e of ['1', String(g.porticos), 'A', HOJAS.letra(naves)]) if (!ejes(h).has(e)) errores.push(`falta la burbuja del eje ${e}`);
  for (const t of [fmt(g.largo), fmt(g.ancho_total)]) {
    if (!cotas(h).some(c => c.endsWith(` ${t}`) && c.includes('total'))) errores.push(`falta la cota total ${t}`);
  }
}

// ---------- Alzado frontal y sección ----------
function transversal(h, { g, naves }, errores) {
  const d = h.dibujo, E = h.escala, k = 1000 / E, mayor = mayorQue(E);
  const dibujadas = Math.min(naves, 3);
  if (d.naves_dibujadas !== dibujadas || d.corte !== naves > 3) errores.push('naves dibujadas o interrupción incorrectas');
  if (!casi(d.w, dibujadas * g.ancho_nave * k + d.hueco) || !casi(d.h, g.altura_cumbrera * k)) errores.push('el dibujo no está a la escala del cajetín');
  if (mayor && dibujadas * g.ancho_nave * 1000 / mayor + d.hueco + 8 <= d.disponible.w && g.altura_cumbrera * 1000 / mayor + 3 <= d.disponible.h) {
    errores.push(`cabría a 1:${mayor}`);
  }
  const c = cotas(h);
  if (!c.some(t => t.includes('canal') && t.endsWith(` ${fmt(g.altura_canal)}`))) errores.push('falta la cota de altura a canal');
  if (!c.some(t => t.includes('cumbrera') && t.endsWith(` ${fmt(g.altura_cumbrera)}`))) errores.push('falta la cota de altura a cumbrera');
  if (!c.some(t => t.includes('ancho total') && t.endsWith(` ${fmt(g.ancho_total)}`))) errores.push('falta la cota del ancho total');
  if (naves > 3 && !c.some(t => t.endsWith(` ${naves - 3} × ${fmt(g.ancho_nave)}`))) errores.push('falta la cota de la interrupción');
  for (const e of ['A', HOJAS.letra(naves)]) if (!ejes(h).has(e)) errores.push(`falta la burbuja del eje ${e}`);

  // Arco real: cada parábola va de canal a canal (ancho de nave) y sube la flecha
  const arcos = [...h.svg.matchAll(/<polyline points="([^"]+)" fill="none" stroke="#000" stroke-width="0.5"\/>/g)]
    .map(m => m[1].split(' ').map(p => p.split(',').map(Number)));
  if (arcos.length !== dibujadas) errores.push(`${arcos.length} arcos dibujados, se esperaban ${dibujadas}`);
  for (const a of arcos) {
    const luz = a[a.length - 1][0] - a[0][0];
    const flecha = a[0][1] - Math.min(...a.map(p => p[1]));
    if (Math.abs(luz - g.ancho_nave * k) > 1e-3) errores.push(`luz del arco ${luz / k} m ≠ ${g.ancho_nave} m`);
    if (Math.abs(flecha - g.flecha * k) > 1e-3) errores.push(`flecha del arco ${flecha / k} m ≠ ${g.flecha} m`);
  }
}

function seccion(h, caso, errores) {
  transversal(h, caso, errores);
  const { ventana } = caso;
  const lineas = ventana ? ventana.lineas : 0;
  const hojas = (h.svg.match(/<polyline [^>]*stroke-width="0\.9"\/>/g) || []).length;
  const esperadas = lineas * Math.min(caso.naves, 3);
  if (hojas !== esperadas) errores.push(`${hojas} hojas de ventana dibujadas, se esperaban ${esperadas}`);
  const rotulo = h.cajas.find(c => c.tipo === 'rotulo');
  const texto = !lineas ? 'Techo cerrado' : lineas === 2 ? 'mariposa' : 'una hoja';
  if (!rotulo) errores.push('falta el rótulo de la ventana cenital');
  else if (!h.svg.includes(texto)) errores.push(`el rótulo no dice "${texto}"`);
  const alfa = lineas ? 2 * Math.asin(Math.min(ventana.rendija, ventana.hoja) / (2 * ventana.hoja)) : 0;
  if (!casi(h.dibujo.apertura, alfa)) errores.push('apertura de la hoja distinta de 2·arcsen(rendija / 2·hoja)');
}

function lateral(h, { g }, errores) {
  const d = h.dibujo, E = h.escala, mayor = mayorQue(E);
  if (!casi(d.w, g.largo * 1000 / E) || !casi(d.h, g.altura_cumbrera * 1000 / E)) errores.push('el dibujo no está a la escala del cajetín');
  if (mayor && g.largo * 1000 / mayor + 8 <= d.disponible.w && g.altura_cumbrera * 1000 / mayor + 3 <= d.disponible.h) errores.push(`cabría a 1:${mayor}`);
  for (const e of ['1', String(g.porticos)]) if (!ejes(h).has(e)) errores.push(`falta la burbuja del eje ${e}`);
  const c = cotas(h);
  for (const t of [fmt(g.largo), fmt(g.altura_canal), fmt(g.altura_cumbrera)]) if (!c.some(x => x.endsWith(` ${t}`))) errores.push(`falta la cota ${t}`);
}

const COMPROBAR = { planta, alzadoFrontal: transversal, alzadoLateral: lateral, seccion };

for (const caso of HOJAS.casos()) {
  const h = HOJAS.generar(caso);
  const errores = [];
  comunes(h, errores);
  COMPROBAR[caso.vista](h, caso, errores);
  recuento[caso.vista] = (recuento[caso.vista] || 0) + 1;
  comprobar(`${caso.nombre} (1:${h.escala})`, errores.length === 0, '\n      ' + errores.slice(0, 8).join('\n      '));
}
console.log('Hojas comprobadas:', Object.entries(recuento).map(([v, n]) => `${v} ${n}`).join(', '));

// Registro: un texto obligatorio que no cabe queda anotado como fallo
{
  const reg = new HOJA.Registro();
  reg.ocupar({ x: 0, y: 0, w: 100, h: 100 }, 'dibujo');
  const r = reg.colocar([{ caja: { x: 10, y: 10, w: 5, h: 5 } }], { tipo: 'cota', nombre: 'prueba' });
  comprobar('el registro rechaza un texto encima de otro y lo apunta como fallo', r === null && reg.fallos.length === 1);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
