// ============================================================
// Exportación a PDF (en Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/pdf_navegador.js   (necesita Playwright; si no, se omite)
// Abre index.html sin conexión, descarga los planos y una hoja suelta, y
// comprueba en el PDF:
//   · nombre «<código>_planos_<fecha>.pdf» y «<código>_04-seccion_<fecha>.pdf»;
//   · 5 páginas con parcela (4 sin ella), todas A3 apaisado (420 × 297 mm);
//   · escala real: cada página dibuja el SVG en mm con la matriz 72/25,4 pt/mm,
//     y en la planta los pórticos están a sep × 1000 / E mm (E leída del cajetín);
//   · el PDF pide imprimir sin reescalar; títulos y nota de oferta presentes;
//   · ninguna petición fuera del equipo.

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const os = require('os');
const EXPORTAR = require('../js/exportar.js');
const { irA } = require('./navegador_pasos.js');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}

// Nombres de archivo (sin navegador)
const hoy = EXPORTAR.fechaISO();
comprobar('nombre con código y fecha', EXPORTAR.nombreArchivo('26JD001', 'planos', new Date(2026, 8, 28)) === '26JD001_planos_2026-09-28.pdf');
comprobar('código con tildes y espacios', EXPORTAR.nombreArchivo('Níjar 2/26', 'planos', new Date(2026, 0, 5)) === 'Nijar_2_26_planos_2026-01-05.pdf');
comprobar('sin código', EXPORTAR.nombreArchivo('', '01-planta', new Date(2026, 0, 5)) === 'proyecto_01-planta_2026-01-05.pdf');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
  } catch (__) {
    console.log('Playwright no está instalado: se omite la parte del navegador.');
    console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
    process.exit(fallos ? 1 : 0);
  }
}

// ---------- Lectura mínima del PDF (jsPDF: objetos sin comprimir, flujos Flate) ----------
function leerPdf(archivo) {
  const t = fs.readFileSync(archivo).toString('latin1');
  const paginas = [...t.matchAll(/\/Type \/Page\b[\s\S]*?\/Contents (\d+) 0 R/g)].map(m => +m[1]);
  const objeto = (n) => {
    const m = t.match(new RegExp(`(?:^|\\n)${n} 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)endstream`));
    if (!m) return '';
    try { return zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch (_) { return m[1]; }
  };
  return {
    bruto: t,
    mediaBoxes: [...t.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map(m => m[1].trim().split(/\s+/).map(Number)),
    contenidos: paginas.map(objeto)
  };
}
const textoDe = (c) => [...c.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(m => m[1].replace(/\\(.)/g, '$1')).join(' | ');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ offline: true, acceptDownloads: true });
  const pagina = await ctx.newPage();
  const externas = [], errores = [];
  pagina.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) externas.push(r.url()); });
  pagina.on('pageerror', e => errores.push(e.message));
  pagina.on('console', m => m.type() === 'error' && errores.push(m.text()));
  await pagina.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pagina.fill('#codigo-proyecto', '26JD001');

  const bajar = async (boton) => {
    const [d] = await Promise.all([pagina.waitForEvent('download'), pagina.click(boton)]);
    const destino = path.join(dir, d.suggestedFilename());
    await d.saveAs(destino);
    return { nombre: d.suggestedFilename(), pdf: leerPdf(destino) };
  };

  // Sin parcela: 4 hojas
  await irA(pagina, 'salidas');
  const sin = await bajar('#btn-pdf-todos');
  comprobar('sin parcela: 4 páginas', sin.pdf.contenidos.length === 4, `${sin.pdf.contenidos.length}`);

  // Con parcela: 5 hojas
  await irA(pagina, 'emplazamiento');
  await pagina.fill('#parcela-largo', '70');
  await pagina.fill('#parcela-ancho', '45');
  await pagina.fill('#parcela-orientacion', '30');
  await irA(pagina, 'salidas');
  const todo = await bajar('#btn-pdf-todos');
  comprobar('nombre del PDF completo', todo.nombre === `26JD001_planos_${hoy}.pdf`, todo.nombre);
  const { mediaBoxes, contenidos, bruto } = todo.pdf;
  comprobar('con parcela: 5 páginas', contenidos.length === 5, `${contenidos.length}`);
  const mm = (pt) => pt * 25.4 / 72;
  comprobar('todas las páginas A3 apaisado (420 × 297 mm)', mediaBoxes.length >= 5 &&
    mediaBoxes.every(b => Math.abs(mm(b[2] - b[0]) - 420) < 0.01 && Math.abs(mm(b[3] - b[1]) - 297) < 0.01), JSON.stringify(mediaBoxes[0]));
  comprobar('el PDF pide imprimir sin reescalar', /\/PrintScaling \/None/.test(bruto));
  const K = 72 / 25.4;
  const matriz = contenidos.every(c => {
    const m = c.match(/([\d.]+) 0\.? 0\.? -([\d.]+) 0\.? ([\d.]+) cm/);
    return m && Math.abs(+m[1] - K) < 1e-9 && Math.abs(+m[2] - K) < 1e-9 && Math.abs(+m[3] - 841.89) < 0.01;
  });
  comprobar('cada página dibuja en mm a 72/25,4 pt por mm (escala 1:1 con el SVG)', matriz);
  // Ninguna otra transformación cambia el tamaño (solo traslaciones y giros de texto)
  const escalados = contenidos.flatMap(c => [...c.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) -?[\d.]+ -?[\d.]+ cm/g)].slice(1)
    .map(m => Math.abs((+m[1]) * (+m[4]) - (+m[2]) * (+m[3]))).filter(det => Math.abs(det - 1) > 1e-6));
  comprobar('ninguna transformación reescala el dibujo', escalados.length === 0, `${escalados.length} (p. ej. ${escalados[0]})`);

  const titulos = ['PLANTA GENERAL', 'ALZADO FRONTAL', 'ALZADO LATERAL', 'SECCI', 'EMPLAZAMIENTO'];
  contenidos.forEach((c, i) => {
    const t = textoDe(c);
    comprobar(`página ${i + 1}: título ${titulos[i]}`, t.includes(titulos[i]));
    comprobar(`página ${i + 1}: nota de plano de oferta`, t.includes('Plano informativo de oferta'));
  });

  // Planta: separación de pórticos en el papel = 4 m × 1000 / E
  const planta = contenidos[0];
  const E = +(textoDe(planta).match(/1:(\d+)/) || [])[1];
  const porticos = [...planta.matchAll(/0\.25 w[\s\S]*?cm\n([\d.]+) ([\d.]+) m\n([\d.]+) ([\d.]+) l\nS/g)]
    .filter(m => Math.abs(+m[1] - +m[3]) < 1e-6).map(m => +m[1]);
  const xs = [...new Set(porticos)].sort((a, b) => a - b);
  const pasos = xs.slice(1).map((x, i) => x - xs[i]);
  const esperado = 4 * 1000 / E;
  comprobar(`planta a 1:${E}: pórticos cada ${esperado} mm en el PDF`, pasos.length >= 10 && pasos.every(p => Math.abs(p - esperado) < 1e-3), JSON.stringify(pasos.slice(0, 5)));

  // Hoja suelta
  await pagina.click('.tab[data-vista="seccion"]');
  const suelta = await bajar('#btn-pdf-hoja');
  comprobar('nombre de la hoja suelta', suelta.nombre === `26JD001_04-seccion_${hoy}.pdf`, suelta.nombre);
  comprobar('hoja suelta: 1 página, la sección', suelta.pdf.contenidos.length === 1 && textoDe(suelta.pdf.contenidos[0]).includes('SECCI'));

  // 6 naves: alzado frontal y sección caben a la misma escala → una hoja (02) y cuatro en total
  await irA(pagina, 'geometria');
  await pagina.fill('#num-naves', '6');
  await irA(pagina, 'salidas');
  const junto = await bajar('#btn-pdf-todos');
  const tJunto = junto.pdf.contenidos.map(textoDe);
  comprobar('6 naves: 4 páginas', junto.pdf.contenidos.length === 4, `${junto.pdf.contenidos.length}`);
  comprobar('6 naves: la 2 es alzado y sección, con los dos títulos', tJunto[1].includes('ALZADO Y SECCI') && tJunto[1].includes('ALZADO FRONTAL') && tJunto[1].includes('SECCIÓN TRANSVERSAL') && tJunto[1].includes('PLANO N.º | 02 |'));
  comprobar('6 naves: números 01 a 04 en los cajetines', ['01', '02', '03', '04'].every((n, i) => tJunto[i].includes(`PLANO N.º | ${n} |`)) && tJunto[3].includes('EMPLAZAMIENTO'));
  await pagina.click('.tab[data-vista="seccion"]');
  const conjunta = await bajar('#btn-pdf-hoja');
  comprobar('hoja suelta desde la pestaña sección: la conjunta', conjunta.nombre === `26JD001_02-alzado-frontal-y-seccion_${hoy}.pdf` && conjunta.pdf.contenidos.length === 1, conjunta.nombre);
  await pagina.click('.tab[data-vista="alzado-frontal"]');
  comprobar('la pestaña alzado frontal muestra la misma hoja', (await pagina.locator('#plan').innerHTML()).includes('ALZADO Y SECCI'));

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
