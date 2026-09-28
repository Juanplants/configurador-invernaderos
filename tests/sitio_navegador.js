// ============================================================
// Viento y nieve por municipio en la app real (Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/sitio_navegador.js   (necesita Playwright; si no, se omite)
// Con la tabla de municipios INVENTADA de las pruebas (se inyecta en la página
// en lugar de datos/municipios.js). Además, con la tabla real vacía la app pide
// los valores a mano.
// 1. Elegir municipio rellena viento y nieve, «del municipio», y la aptitud.
// 2. Escribir a mano: «manual»; «Usar los valores del municipio» los devuelve.
// 3. Categoría de terreno con su explicación, pendiente.
// 4. La parcela del Catastro de rústica trae el municipio.
// 5. Propuesta: tabla de cargas del sitio frente a las declaradas, con la nota.
// 6. Guardar y abrir conserva municipio, manuales, categoría y pendiente.

const path = require('path');
const fs = require('fs');
const os = require('os');
const SITIO = require('../js/sitio.js');
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
const DATOS = path.join(__dirname, 'datos');
const normativa = JSON.parse(fs.readFileSync(path.join(DATOS, 'cte_prueba.json'), 'utf8'));
const tabla = SITIO.leerCSV(fs.readFileSync(path.join(DATOS, 'municipios_prueba.csv'), 'utf8'));
const DATOS_PRUEBA = SITIO.empaquetar(normativa, tabla, { archivo: 'municipios_prueba.csv' });
// Sustituye los datos de datos/municipios.js por los de prueba (la asignación del archivo se ignora)
const inyectar = `(() => { const d = ${JSON.stringify(DATOS_PRUEBA)}; Object.defineProperty(window, 'SITIO_DATOS', { get() { return d; }, set() {}, configurable: false }); })()`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitio-'));
  const navegador = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const errores = [], externas = [];
  const nueva = async (conDatos) => {
    const ctx = await navegador.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errores.push(e.message));
    p.on('console', m => m.type() === 'error' && errores.push(m.text()));
    p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) externas.push(r.url()); });
    if (conDatos) await p.addInitScript(inyectar);
    await p.goto(url);
    return p;
  };

  // ---------- Sin tabla (la del repositorio está vacía hasta tener la oficial) ----------
  console.log('0. Sin tabla de municipios');
  {
    const p = await nueva(false);
    await irA(p, 'emplazamiento');
    comprobar('municipio desactivado', await p.isDisabled('#municipio'));
    comprobar('pide viento y nieve a mano', (await p.locator('#municipio-info').innerText()).includes('a mano'));
    await p.fill('#viento', '90');
    comprobar('viento a mano: «manual» y aptitud', (await p.locator('#viento-origen').innerText()) === 'manual' && (await p.locator('#aptitud-modelos').innerText()).includes('Al límite'));
    comprobar('categorías de terreno de la normativa', (await p.locator('#categoria-terreno option').count()) === 5);
    await p.context().close();
  }

  const p = await nueva(true);
  const info = () => p.locator('#municipio-info').innerText();
  // ---------- 1. Elegir municipio ----------
  console.log('1. Elegir municipio');
  await irA(p, 'emplazamiento');
  comprobar('lista de municipios', await p.locator('#lista-municipios option').count() === 4);
  await p.fill('#municipio', 'Sierra de Ensayo (Provincia de Ensayo)');
  await p.press('#municipio', 'Tab');
  comprobar('viento de la zona C: 104,4 km/h', await p.inputValue('#viento') === '104.4', await p.inputValue('#viento'));
  comprobar('nieve zona 3 a 1100 m: 92 kg/m²', await p.inputValue('#nieve') === '92', await p.inputValue('#nieve'));
  comprobar('los dos «del municipio»', (await p.locator('#viento-origen').innerText()) === 'del municipio' && (await p.locator('#nieve-origen').innerText()) === 'del municipio');
  const texto = await info();
  comprobar('datos del municipio: zona, vb, qb, ce, altitud, sk', /Zona eólica C/.test(texto) && /29 m\/s/.test(texto) && /0,52 kN\/m²/.test(texto) && /ce/.test(texto) && /1100 m/.test(texto) && /0,9 kN\/m²/.test(texto), texto);
  const apt = await p.locator('#aptitud-modelos').innerText();
  comprobar('aptitud: viento no apto (104,4 > 94) y nieve sin dato', /No apto/.test(apt) && /sin dato/.test(apt), apt);
  await irA(p, 'revision');
  comprobar('Revisión: aviso de nieve sin dato del fabricante', (await p.locator('#summary .avisos').innerText()).includes('no declara carga de nieve'));
  await irA(p, 'emplazamiento');
  await p.fill('#municipio', 'Villaprueba');
  await p.press('#municipio', 'Tab');
  comprobar('nombre repetido en dos provincias: pide elegir', (await info()).includes('no está en la tabla') && await p.inputValue('#viento') === '104.4');
  await p.fill('#municipio', 'villaprueba (otra provincia)');
  await p.press('#municipio', 'Tab');
  comprobar('sin tildes ni mayúsculas: Villaprueba (Otra Provincia), zona B', await p.inputValue('#viento') === '97.2' && await p.inputValue('#municipio') === 'Villaprueba (Otra Provincia)');

  // ---------- 2. Valores a mano ----------
  console.log('2. A mano');
  await p.fill('#viento', '80');
  comprobar('viento escrito: «manual»', (await p.locator('#viento-origen').innerText()) === 'manual' && (await p.locator('#nieve-origen').innerText()) === 'del municipio');
  comprobar('botón para volver a los del municipio', await p.isVisible('#btn-cargas-municipio'));
  comprobar('la aptitud usa el manual', !(await p.locator('#aptitud-modelos').innerText()).includes('No apto'));
  await p.selectOption('#categoria-terreno', 'III');
  comprobar('el manual no se pisa al cambiar otra cosa', await p.inputValue('#viento') === '80');
  await p.click('#btn-cargas-municipio');
  comprobar('«Usar los valores del municipio» los devuelve', await p.inputValue('#viento') === '97.2' && (await p.locator('#viento-origen').innerText()) === 'del municipio' && !(await p.isVisible('#btn-cargas-municipio')));

  // ---------- 3. Categoría y pendiente ----------
  console.log('3. Categoría de terreno y pendiente');
  comprobar('explicación de la categoría', (await p.locator('#categoria-explicacion').innerText()) === 'Prueba III.');
  const ceIII = (await info()).match(/ce ([\d,]+)/);
  await p.selectOption('#categoria-terreno', 'I');
  const ceI = (await info()).match(/ce ([\d,]+)/);
  comprobar('la categoría cambia ce (I > III)', ceI && ceIII && parseFloat(ceI[1].replace(',', '.')) > parseFloat(ceIII[1].replace(',', '.')), `${ceI && ceI[1]} vs ${ceIII && ceIII[1]}`);
  await p.selectOption('#categoria-terreno', 'III');
  await p.fill('#pendiente', '3');

  // ---------- 4. Municipio desde la parcela del Catastro ----------
  console.log('4. Parcela del Catastro de rústica');
  const gml = fs.readFileSync(path.join(DATOS, 'parcela_irregular.gml'), 'utf8').split('00000X00000000').join('99103A001000010000XX');
  await p.setInputFiles('#archivo-parcela', { name: 'rustica.gml', mimeType: 'text/xml', buffer: Buffer.from(gml) });
  await p.waitForSelector('.parcela-cargada');
  comprobar('la refcat trae el municipio: Llanos de Prueba', await p.inputValue('#municipio') === 'Llanos de Prueba (Provincia de Ensayo)', await p.inputValue('#municipio'));
  comprobar('y sus cargas: 97,2 km/h y 43 kg/m²', await p.inputValue('#viento') === '97.2' && await p.inputValue('#nieve') === '43', `${await p.inputValue('#viento')} ${await p.inputValue('#nieve')}`);

  // ---------- 5. Propuesta ----------
  console.log('5. Propuesta');
  await p.fill('#nieve', '150');
  await irA(p, 'salidas');
  await p.click('#btn-propuesta');
  const prop = await p.locator('#propuesta-container').innerText();
  comprobar('tabla de cargas del sitio frente a las declaradas', /Cargas del sitio frente a las declaradas por el fabricante/i.test(prop), prop.slice(0, 200));
  comprobar('viento del municipio y nieve manual', /97,2 km\/h\s*CTE DB SE-AE, por municipio/.test(prop) && /150 kg\/m²\s*introducido a mano/.test(prop));
  comprobar('municipio, categoría y pendiente', prop.includes('Llanos de Prueba (Provincia de Ensayo)') && prop.includes('III. Zona rural accidentada') && prop.includes('3 %'));
  comprobar('nota: no sustituye al cálculo estructural', prop.includes('no sustituye al cálculo estructural'));
  await p.click('#btn-cerrar-propuesta');

  // ---------- 6. Guardar y abrir ----------
  console.log('6. Guardar y abrir');
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#btn-guardar-proyecto')]);
  const archivo = path.join(dir, d.suggestedFilename());
  await d.saveAs(archivo);
  const json = JSON.parse(fs.readFileSync(archivo, 'utf8')).proyecto;
  comprobar('el archivo guarda el sitio', json.sitio.municipio === '99003' && json.sitio.categoria === 'III' && json.sitio.pendiente === 3 && json.sitio.nieve_manual === true && json.sitio.viento_manual === false && json.nieve_kgm2 === 150);
  await p.goto(url);
  await p.setInputFiles('#archivo-proyecto', archivo);
  await p.waitForSelector('body.dialogo-abierto');
  await p.click('#btn-cerrar-dialogo');
  await irA(p, 'emplazamiento');
  comprobar('vuelven municipio, valores y origen', await p.inputValue('#municipio') === 'Llanos de Prueba (Provincia de Ensayo)' && await p.inputValue('#viento') === '97.2' && await p.inputValue('#nieve') === '150'
    && (await p.locator('#nieve-origen').innerText()) === 'manual' && (await p.locator('#viento-origen').innerText()) === 'del municipio');
  comprobar('vuelven categoría y pendiente', await p.inputValue('#categoria-terreno') === 'III' && await p.inputValue('#pendiente') === '3');

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
