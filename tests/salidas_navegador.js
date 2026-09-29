// ============================================================
// Salidas en la app real (Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/salidas_navegador.js   (necesita Playwright; si no, se omite)
// 1. Guardar proyecto, recargar, abrirlo: la pantalla y el total vuelven igual;
//    con otro catálogo avisa; con un catálogo sin el modelo, no se abre.
// 2. Excel: el botón descarga «<código>_materiales_<fecha>.xlsx» con las dos hojas.
// 3. Propuesta impresa a PDF: páginas A4 verticales y una A3 apaisada por plano;
//    en impresión, cada plano mide 420 × 297 mm (escala real).

const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('./xlsx_lib.js');
const EXPORTAR = require('../js/exportar.js');
const { irA } = require('./navegador_pasos.js');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
  } catch (__) {
    console.log('Playwright no está instalado: prueba omitida.');
    process.exit(0);
  }
}

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salidas-'));
  const hoy = EXPORTAR.fechaISO();
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ offline: true, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [], externas = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => m.type() === 'error' && errores.push(m.text()));
  p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) externas.push(r.url()); });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await p.goto(url);
  const bajar = async (selector) => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(selector)]);
    const destino = path.join(dir, d.suggestedFilename());
    await d.saveAs(destino);
    return { nombre: d.suggestedFilename(), destino };
  };

  // ---------- 1. Proyecto ----------
  console.log('1. Guardar y abrir proyecto');
  await p.fill('#codigo-proyecto', '26JD001'); await p.fill('#cliente', 'Finca La Prueba'); await p.fill('#ubicacion', 'Níjar');
  await irA(p, 'emplazamiento');
  await p.fill('#viento', '90');
  await p.fill('#parcela-largo', '150'); await p.fill('#parcela-ancho', '80'); await p.fill('#parcela-orientacion', '30'); await p.check('#parcela-girado');
  await irA(p, 'geometria');
  await p.selectOption('#model-select', 'MT-GOT-96');
  await p.fill('#num-naves', '6'); await p.fill('#num-tramos', '22');
  await p.selectOption('#altura-canal', '5');
  await irA(p, 'envolvente');
  await p.selectOption('[data-grupo="ventilacion_cenital"]', 'C21');
  await p.uncheck('[data-grupo="ventilacion_lateral"]');
  await p.fill('#puertas', '2');
  await irA(p, 'salidas');
  await p.click('.tab[data-vista="seccion"]');
  const campos = ['#model-select', '#num-naves', '#num-tramos', '#altura-canal', '[data-grupo="ventilacion_cenital"]', '#puertas', '#viento',
    '#codigo-proyecto', '#cliente', '#ubicacion', '#parcela-largo', '#parcela-ancho', '#parcela-orientacion'];
  const foto = async () => ({
    campos: await Promise.all(campos.map(c => p.inputValue(c))),
    lateral: await p.isChecked('[data-grupo="ventilacion_lateral"]'),
    girado: await p.isChecked('#parcela-girado'),
    pestana: await p.locator('.tab.active').getAttribute('data-vista'),
    resumen: await p.locator('.summary-grid').innerText(),
    lista: await p.locator('.tabla-materiales').innerText()
  });
  const antes = await foto();
  const guardado = await bajar('#btn-guardar-proyecto');
  comprobar('nombre del proyecto', guardado.nombre === `26JD001_proyecto_${hoy}.json`, guardado.nombre);

  await p.goto(url); // pantalla nueva, valores por defecto
  comprobar('al recargar se empieza en el paso 1', await p.locator('.paso-boton.actual').getAttribute('data-ir') === 'proyecto');
  const vacia = await foto();
  comprobar('tras recargar, la pantalla ha cambiado', JSON.stringify(vacia) !== JSON.stringify(antes));
  await p.setInputFiles('#archivo-proyecto', guardado.destino);
  await p.waitForSelector('body.dialogo-abierto');
  comprobar('abre sin avisos con el mismo catálogo', (await p.locator('#dialogo-catalogo-contenido').innerText()).includes('mismo catálogo'));
  await p.click('#btn-cerrar-dialogo');
  const despues = await foto();
  for (const k of Object.keys(antes)) comprobar(`restaura ${k}`, JSON.stringify(despues[k]) === JSON.stringify(antes[k]), `${JSON.stringify(despues[k]).slice(0, 80)} ≠ ${JSON.stringify(antes[k]).slice(0, 80)}`);

  // Otro catálogo (mismo nombre y versión, un precio distinto): se abre con aviso
  await p.evaluate(() => { const c = JSON.parse(JSON.stringify(window.CATALOGO_EJEMPLO)); c.perfiles[0].precio += 0.2; aplicarCatalogo(c, { archivo: 'Catalogo_modificado.xlsx' }); render(); });
  await p.setInputFiles('#archivo-proyecto', guardado.destino);
  await p.waitForSelector('body.dialogo-abierto');
  const aviso = await p.locator('#dialogo-catalogo-contenido').innerText();
  comprobar('otro catálogo: se abre con aviso', aviso.includes('Proyecto abierto') && aviso.includes('contenido distinto'), aviso.slice(0, 200));
  await p.click('#btn-cerrar-dialogo');
  // Catálogo sin el modelo: no se abre
  await p.evaluate(() => { const c = JSON.parse(JSON.stringify(window.CATALOGO_EJEMPLO)); c.modelos = c.modelos.filter(m => m.id !== 'MT-GOT-96'); aplicarCatalogo(c, { archivo: 'Otro.xlsx' }); render(); });
  await p.setInputFiles('#archivo-proyecto', guardado.destino);
  await p.waitForSelector('body.dialogo-abierto');
  const error = await p.locator('#dialogo-catalogo-contenido').innerText();
  comprobar('catálogo sin el modelo: no se abre', error.includes('no se ha abierto') && error.includes('MT-GOT-96'));
  await p.click('#btn-cerrar-dialogo');
  await p.goto(url);
  await p.setInputFiles('#archivo-proyecto', guardado.destino);
  await p.waitForSelector('body.dialogo-abierto');
  await p.click('#btn-cerrar-dialogo');

  comprobar('un proyecto abierto deja ir a cualquier paso', await p.locator('.paso-boton:disabled').count() === 0);
  // ---------- 2. Excel ----------
  console.log('2. Lista de materiales en Excel');
  await irA(p, 'salidas');
  const excel = await bajar('#btn-excel');
  comprobar('nombre del Excel', excel.nombre === `26JD001_materiales_${hoy}.xlsx`, excel.nombre);
  const libro = XLSX.read(fs.readFileSync(excel.destino));
  comprobar('hojas Materiales y Petición de oferta', JSON.stringify(libro.SheetNames) === '["Materiales","Petición de oferta"]');
  await irA(p, 'revision');
  const filasPantalla = (await p.locator('.tabla-materiales tr').count());
  const m = XLSX.utils.sheet_to_json(libro.Sheets.Materiales, { header: 1 });
  const total = m.find(f => f[1] === 'Total');
  const totalPantalla = (await p.locator('.summary-grid .cell').last().innerText()).match(/[\d.]+ €/)[0];
  comprobar('el total del Excel es el de la pantalla', total && Math.round(total[7]).toLocaleString('es-ES') + ' €' === totalPantalla, `${total && total[7]} vs ${totalPantalla}`);
  comprobar('hay filas de materiales', filasPantalla > 10 && m.length > 20);

  // ---------- 3. Propuesta ----------
  console.log('3. Propuesta impresa');
  await irA(p, 'salidas');
  await p.click('#btn-propuesta');
  await p.emulateMedia({ media: 'print' });
  comprobar('en impresión no sale la barra de pasos', await p.$eval('#barra-pasos', el => getComputedStyle(el).display) === 'none');
  const medidas = await p.$$eval('section.hoja-a3 svg.plano-a3', svgs => svgs.map(s => { const r = s.getBoundingClientRect(); return [r.width, r.height]; }));
  const mm = (px) => px * 25.4 / 96;
  // 6 naves: alzado frontal y sección caben en una hoja → cuatro planos
  const planosProp = await p.$$eval('section.hoja-a3', ss => ss.map(x => x.dataset.plano));
  comprobar('4 planos en la propuesta, alzado y sección juntos', medidas.length === 4 && JSON.stringify(planosProp) === '["planta","alzadoSeccion","alzadoLateral","emplazamiento"]', JSON.stringify(planosProp));
  comprobar('en impresión cada plano mide 420 × 297 mm', medidas.every(([w, h]) => Math.abs(mm(w) - 420) < 0.1 && Math.abs(mm(h) - 297) < 0.1), JSON.stringify(medidas.map(([w, h]) => [mm(w).toFixed(1), mm(h).toFixed(1)])));
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(dir, 'propuesta.pdf'), pdf);
  const cajas = [...pdf.toString('latin1').matchAll(/\/MediaBox \[([^\]]+)\]/g)].map(x => x[1].trim().split(/\s+/).map(Number))
    .map(b => [Math.round((b[2] - b[0]) * 25.4 / 72), Math.round((b[3] - b[1]) * 25.4 / 72)]);
  const a3 = cajas.filter(([w, h]) => w === 420 && h === 297).length;
  const a4 = cajas.filter(([w, h]) => w === 210 && h === 297).length;
  comprobar('PDF de la propuesta: 4 páginas A3 apaisadas (planos)', a3 === 4, JSON.stringify(cajas));
  comprobar('PDF de la propuesta: el resto A4 vertical', a4 >= 6 && a4 + a3 === cajas.length, JSON.stringify(cajas));
  const texto = await p.locator('#propuesta-container').innerText();
  comprobar('propuesta: nota de planos informativos', texto.includes('No válidos para ejecución ni tramitación'));
  comprobar('propuesta: distribuidor', texto.includes('Oferta presentada por'));

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
