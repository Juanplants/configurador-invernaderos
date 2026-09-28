// ============================================================
// Pruebas de las hojas de planos (fase 4)
// ============================================================
// Ejecutar:  node tests/planos.js
// Aceptación: en 1/2/5/10 naves × 10/20/60 tramos, en los dos modelos del
// catálogo de ejemplo, para planta, alzado frontal, alzado lateral y sección
// (esta con techo cerrado, una hoja y mariposa):
//   · cero solapes y todo dentro del marco;
//   · el dibujo ocupa al menos el 50 % del ancho o del alto disponible;
//   · escala de la serie, la mayor con la que caben cotas, ejes y rótulos
//     (a la siguiente mayor, la hoja no cabe o le falta algún texto), y real;
//   · planta con el lado largo en horizontal; alzados enteros si caben a 1:300
//     o mayor; puertas del catálogo dibujadas; nota de plano de oferta.
// En la sección, además, el arco, las alturas y la ventana cenital del catálogo.
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
  if (!HOJA.ESCALAS.includes(h.escala)) errores.push(`escala 1:${h.escala} fuera de la serie`);
  if (!h.svg.includes(`>1:${h.escala}<`)) errores.push('el cajetín no muestra la escala');
  if (!h.svg.includes(`>${HOJA.NOTA_CAJETIN}<`)) errores.push('falta la nota de plano de oferta en el cajetín');
  // Todo texto debe poder escribirse con la Helvetica del PDF (WinAnsi)
  const textos = [...h.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const raros = [...new Set(textos.join('').split('').filter(c => !HOJA.enWinAnsi(c)))];
  if (raros.length) errores.push(`caracteres que el PDF no puede escribir: ${raros.join(' ')}`);
  const ocupa = HOJA.ocupacion(h.dibujo);
  if (ocupa < 0.5) errores.push(`el dibujo ocupa solo el ${(ocupa * 100).toFixed(0)} % del espacio disponible`);
}
const noVale = (h) => !h.cabe || h.fallos.length > 0;
const puertasDibujadas = (h) => (h.svg.match(/data-puerta=/g) || []).length;
const mayorQue = (E) => HOJA.ESCALAS[HOJA.ESCALAS.indexOf(E) - 1];
const casi = (a, b) => Math.abs(a - b) < 1e-6;
const cotas = (h) => h.cajas.filter(c => c.tipo === 'cota').map(c => c.nombre);
const ejes = (h) => new Set(h.cajas.filter(c => c.tipo === 'eje').map(c => c.nombre));

// ---------- Planta ----------
function planta(h, caso, errores) {
  const { g, naves } = caso;
  const d = h.dibujo, E = h.escala, mayor = mayorQue(E);
  if (mayor && !noVale(HOJAS.PLANTA.dibujarPlanta(HOJAS.datos(caso), mayor))) errores.push(`cabría a 1:${mayor}`);
  if (d.largoEnX !== (g.largo >= g.ancho_total)) errores.push('el lado largo no está en horizontal');
  const esperadas = Math.min(caso.puertas ? caso.puertas.cantidad : 1, 2 * naves);
  if (puertasDibujadas(h) !== esperadas) errores.push(`${puertasDibujadas(h)} puertas dibujadas, se esperaban ${esperadas}`);
  const [enX, enY] = d.largoEnX ? [g.largo, g.ancho_total] : [g.ancho_total, g.largo];
  if (!casi(d.w, enX * 1000 / E) || !casi(d.h, enY * 1000 / E)) errores.push('el dibujo no está a la escala del cajetín');
  for (const e of ['1', String(g.porticos), 'A', HOJAS.letra(naves)]) if (!ejes(h).has(e)) errores.push(`falta la burbuja del eje ${e}`);
  for (const t of [fmt(g.largo), fmt(g.ancho_total)]) {
    if (!cotas(h).some(c => c.endsWith(` ${t}`) && c.includes('total'))) errores.push(`falta la cota total ${t}`);
  }
}

// ---------- Alzado frontal y sección ----------
function transversal(h, caso, errores) {
  const { g, naves } = caso;
  const d = h.dibujo, E = h.escala, k = 1000 / E, mayor = mayorQue(E);
  const T = HOJAS.TRANSVERSAL, datos = HOJAS.datos(caso), tipo = caso.vista === 'seccion' ? 'seccion' : 'frontal';
  const prueba = (e, m) => T.dibujarTransversal(tipo, datos, e, T.navesDibujadas(naves, m));
  const enteroCabe = HOJA.ESCALAS.filter(e => e <= T.COMPLETO_HASTA).some(e => !noVale(prueba(e, naves)));
  if (enteroCabe) {
    // Entero, a la mayor escala posible
    if (d.corte) errores.push('interrumpido aunque cabe entero a 1:300 o mayor');
    if (mayor && !noVale(prueba(mayor, naves))) errores.push(`cabría entero a 1:${mayor}`);
  } else {
    // Interrumpido: a la mayor escala con al menos 2 naves, y tantas como quepan
    if (!d.corte) errores.push('entero a una escala menor que 1:300');
    const cabenMas = (e) => Array.from({ length: naves - 2 }, (_, i) => i + 2).some(m => !noVale(prueba(e, m)));
    if (mayor && cabenMas(mayor)) errores.push(`cabría interrumpido a 1:${mayor}`);
    if (d.naves_dibujadas + 1 < naves && !noVale(prueba(E, d.naves_dibujadas + 1))) errores.push('caben más naves a la misma escala');
  }
  const dibujadas = d.naves_dibujadas;
  if (!casi(d.w, dibujadas * g.ancho_nave * k + d.hueco) || !casi(d.h, g.altura_cumbrera * k)) errores.push('el dibujo no está a la escala del cajetín');
  if (caso.vista === 'alzadoFrontal') {
    const cantidad = caso.puertas ? caso.puertas.cantidad : 1;
    const frente = Array.from({ length: Math.min(cantidad, naves) }, (_, i) => i);
    const esperadas = frente.filter(j => HOJAS.TRANSVERSAL.navesDibujadas(naves, dibujadas).includes(j)).length;
    if (puertasDibujadas(h) !== esperadas) errores.push(`${puertasDibujadas(h)} puertas dibujadas en el frontal, se esperaban ${esperadas}`);
  }
  const c = cotas(h);
  if (!c.some(t => t.includes('canal') && t.endsWith(` ${fmt(g.altura_canal)}`))) errores.push('falta la cota de altura a canal');
  if (!c.some(t => t.includes('cumbrera') && t.endsWith(` ${fmt(g.altura_cumbrera)}`))) errores.push('falta la cota de altura a cumbrera');
  if (!c.some(t => t.includes('ancho total') && t.endsWith(` ${fmt(g.ancho_total)}`))) errores.push('falta la cota del ancho total');
  if (d.corte && !c.some(t => t.endsWith(` ${naves - dibujadas} × ${fmt(g.ancho_nave)}`))) errores.push('falta la cota de la interrupción');
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
  const esperadas = lineas * h.dibujo.naves_dibujadas;
  if (hojas !== esperadas) errores.push(`${hojas} hojas de ventana dibujadas, se esperaban ${esperadas}`);
  const rotulo = h.cajas.find(c => c.tipo === 'rotulo');
  const texto = !lineas ? 'Techo cerrado' : lineas === 2 ? 'mariposa' : 'una hoja';
  if (!rotulo) errores.push('falta el rótulo de la ventana cenital');
  else if (!h.svg.includes(texto)) errores.push(`el rótulo no dice "${texto}"`);
  const alfa = lineas ? 2 * Math.asin(Math.min(ventana.rendija, ventana.hoja) / (2 * ventana.hoja)) : 0;
  if (!casi(h.dibujo.apertura, alfa)) errores.push('apertura de la hoja distinta de 2·arcsen(rendija / 2·hoja)');
}

function lateral(h, caso, errores) {
  const { g } = caso;
  const d = h.dibujo, E = h.escala, mayor = mayorQue(E);
  if (!casi(d.w, g.largo * 1000 / E) || !casi(d.h, g.altura_cumbrera * 1000 / E)) errores.push('el dibujo no está a la escala del cajetín');
  if (mayor && !noVale(HOJAS.LATERAL.dibujarLateral(HOJAS.datos(caso), mayor))) errores.push(`cabría a 1:${mayor}`);
  for (const e of ['1', String(g.porticos)]) if (!ejes(h).has(e)) errores.push(`falta la burbuja del eje ${e}`);
  const c = cotas(h);
  for (const t of [fmt(g.largo), fmt(g.altura_canal), fmt(g.altura_cumbrera)]) if (!c.some(x => x.endsWith(` ${t}`))) errores.push(`falta la cota ${t}`);
}

// ---------- Emplazamiento ----------
function emplazamiento(h, caso, errores) {
  const { g, parcela } = caso;
  const E = h.escala, mayor = mayorQue(E), e = h.encaje;
  if (mayor && !noVale(HOJAS.EMPLAZAMIENTO.dibujarEmplazamiento(HOJAS.datos(caso), mayor))) errores.push(`cabría a 1:${mayor}`);
  // Encaje independiente: invernadero centrado, lado más largo de la parcela en horizontal
  const Lg = parcela.girado ? g.ancho_total : g.largo, Ag = parcela.girado ? g.largo : g.ancho_total;
  const debeCaber = Lg <= parcela.largo + 1e-9 && Ag <= parcela.ancho + 1e-9;
  if (e.cabe !== debeCaber) errores.push(`cabe = ${e.cabe}, debería ser ${debeCaber}`);
  if (e.PX < e.PY) errores.push('el lado largo de la parcela no está en horizontal');
  const c = cotas(h);
  const tiene = (nombre, v) => c.some(t => t.includes(nombre) && t.endsWith(` ${fmt(v)}`));
  if (!tiene('parcela total', e.PX) || !tiene('parcela total', e.PY)) errores.push('faltan las cotas totales de la parcela');
  const aviso = h.svg.includes('>EL INVERNADERO NO CABE EN LA PARCELA<');
  if (debeCaber) {
    if (aviso) errores.push('avisa de que no cabe, pero cabe');
    // Distancias a los linderos: (P − G) / 2 a cada lado, y suman con el invernadero la parcela
    const dx = (e.PX - e.GX) / 2, dy = (e.PY - e.GY) / 2;
    for (const [d, G] of [[dx, e.GX], [dy, e.GY]]) {
      if (d > 0.005 && !tiene('lindero', d)) errores.push(`falta la distancia al lindero ${fmt(d)}`);
      if (!tiene('lindero', G) && !(d <= 0.005 && tiene('parcela total', G))) errores.push(`falta la cota del invernadero ${fmt(G)}`);
    }
    if (Math.abs(2 * dx + e.GX - e.PX) > 1e-9 || Math.abs(2 * dy + e.GY - e.PY) > 1e-9) errores.push('las distancias no suman la parcela');
  } else {
    if (!aviso) errores.push('falta el aviso de que no cabe');
    if (c.some(t => t.includes('lindero'))) errores.push('acota distancias a los linderos aunque no cabe');
  }
  // Norte: 90° − azimut del eje x del papel
  const azX = parcela.largo >= parcela.ancho ? parcela.orientacion : parcela.orientacion - 90;
  const norte = ((90 - azX) % 360 + 360) % 360;
  if (!h.svg.includes(`rotate(${norte})`)) errores.push(`el norte no está a ${norte}°`);
}

const COMPROBAR = { planta, alzadoFrontal: transversal, alzadoLateral: lateral, seccion, emplazamiento };

for (const caso of HOJAS.casos()) {
  const h = HOJAS.generar(caso);
  const errores = [];
  comunes(h, errores);
  COMPROBAR[caso.vista](h, caso, errores);
  recuento[caso.vista] = (recuento[caso.vista] || 0) + 1;
  comprobar(`${caso.nombre} (1:${h.escala})`, errores.length === 0, '\n      ' + errores.slice(0, 8).join('\n      '));
}
console.log('Hojas comprobadas:', Object.entries(recuento).map(([v, n]) => `${v} ${n}`).join(', '));

// Ejemplo del encargo: 10 × 9,60 × 80 m → planta girada a 1:500
{
  const m = HOJAS.catalogo.modelos.find(x => x.id === 'MT-GOT-96');
  const g = HOJAS.GEO.calcular(m, { naves: 10, tramos: 20 });
  const h = HOJAS.PLANTA.planta(HOJAS.datos({ g, modelo: m }));
  comprobar('10 × 9,60 × 80 m: planta girada a 1:500', h.escala === 500 && h.dibujo.largoEnX === false, `1:${h.escala}`);
}

// Puertas: entre pilares de hastial (ninguno dentro del hueco) y en el más centrado
for (const m of HOJAS.catalogo.modelos) {
  const g = HOJAS.GEO.calcular(m, { naves: 3, tramos: 11 });
  const lista = HOJA.puertasEnHastiales(g, m, HOJAS.PUERTAS(4));
  const porNave = Math.round(g.ancho_nave / m.sep_pilares_hastial) - 1;
  const pilares = [];
  for (let j = 0; j < g.naves; j++) for (let q = 1; q <= porNave; q++) pilares.push(j * g.ancho_nave + q * g.ancho_nave / (porNave + 1));
  const libres = lista.every(p => pilares.every(x => x <= p.centro - p.ancho / 2 + 1e-9 || x >= p.centro + p.ancho / 2 - 1e-9));
  comprobar(`${m.id}: 4 puertas (3 delante, 1 detrás) sin pilares de hastial dentro`, libres && lista.filter(p => p.hastial === 0).length === 3 && lista.length === 4);
}
{
  const m = HOJAS.catalogo.modelos.find(x => x.id === 'MT-GOT-96');
  const p = HOJA.puertasEnHastiales(HOJAS.GEO.calcular(m, { naves: 1, tramos: 10 }), m, HOJAS.PUERTAS(1))[0];
  comprobar('MT-GOT-96: la puerta va en el hueco central (4,80 m)', Math.abs(p.centro - 4.8) < 1e-9, `centro ${p.centro}`);
}

// Norte: gira con la planta (azimut del eje largo θ → norte en el papel a 90° − θ, o 180° − θ si la planta va girada)
{
  const m = HOJAS.catalogo.modelos[0];
  const normal = HOJAS.PLANTA.planta(Object.assign(HOJAS.datos({ g: HOJAS.GEO.calcular(m, { naves: 3, tramos: 11 }), modelo: m }), { orientacion: 30 }));
  const girada = HOJAS.PLANTA.planta(Object.assign(HOJAS.datos({ g: HOJAS.GEO.calcular(m, { naves: 10, tramos: 10 }), modelo: m }), { orientacion: 30 }));
  const sin = HOJAS.PLANTA.planta(HOJAS.datos({ g: HOJAS.GEO.calcular(m, { naves: 3, tramos: 11 }), modelo: m }));
  comprobar('norte a 60° con la planta normal', normal.svg.includes('rotate(60)') && normal.fallos.length === 0);
  comprobar('norte a 150° con la planta girada', girada.svg.includes('rotate(150)') && girada.fallos.length === 0);
  comprobar('sin orientación no se dibuja el norte', !sin.cajas.some(c => c.tipo === 'norte'));
}

// Textos del usuario con caracteres fuera de WinAnsi: se sustituyen, no rompen el PDF
{
  const m = HOJAS.catalogo.modelos[0];
  const d = Object.assign(HOJAS.datos({ g: HOJAS.GEO.calcular(m, { naves: 2, tramos: 10 }), modelo: m }),
    { proyecto: { cliente: 'Finca ≈ Norte 🌱 农场', codigo: 'X−1', ubicacion: 'Níjar' } });
  const h = HOJAS.PLANTA.planta(d);
  const textos = [...h.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(x => x[1]).join('');
  comprobar('textos del usuario pasados a WinAnsi', [...textos].every(HOJA.enWinAnsi) && textos.includes('Finca aprox. Norte') && textos.includes('X-1'));
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
