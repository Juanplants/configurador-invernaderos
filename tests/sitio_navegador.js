// ============================================================
// Viento y nieve del sitio en la app real (Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/sitio_navegador.js   (necesita Playwright; si no, se omite)
// 1. Zona eólica, zona invernal y altitud → viento y nieve del CTE; nota con
//    las figuras D.1 y E.2; sin tabla de municipios, su campo no aparece.
// 2. Nieve fuera de la tabla E.2: «fuera de tabla, requiere estudio».
// 3. Capital de la tabla 3.8 como atajo.
// 4. Escribir a mano: «manual»; «Usar los valores del CTE» los devuelve.
// 5. Categoría de terreno con su explicación, pendiente.
// 6. Propuesta: tabla de cargas del sitio frente a las declaradas, con la nota.
// 7. Guardar y abrir conserva todo.
// 8. Con una tabla de municipios (INVENTADA, inyectada en la página): el
//    municipio rellena zonas y altitud, también desde la parcela de rústica.

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
const normativa = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'cte_se_ae.json'), 'utf8'));
const tabla = SITIO.leerCSV(fs.readFileSync(path.join(DATOS, 'municipios_prueba.csv'), 'utf8'));
// Sustituye los datos de datos/municipios.js por la normativa real + municipios de prueba
const inyectar = `(() => { const d = ${JSON.stringify(SITIO.empaquetar(normativa, tabla, { archivo: 'municipios_prueba.csv' }))}; Object.defineProperty(window, 'SITIO_DATOS', { get() { return d; }, set() {}, configurable: false }); })()`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitio-'));
  const navegador = await chromium.launch();
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const errores = [], externas = [];
  const nueva = async (conMunicipios) => {
    const ctx = await navegador.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errores.push(e.message));
    p.on('console', m => m.type() === 'error' && errores.push(m.text()));
    p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) externas.push(r.url()); });
    if (conMunicipios) await p.addInitScript(inyectar);
    await p.goto(url);
    return p;
  };

  const p = await nueva(false);
  const info = () => p.locator('#sitio-info').innerText();
  const origen = (t) => p.locator(`#${t}-origen`).innerText();
  // ---------- 1. Zonas y altitud ----------
  console.log('1. Zonas y altitud');
  await irA(p, 'emplazamiento');
  comprobar('nota: figuras D.1 y E.2 del CTE', (await p.locator('section[data-paso="emplazamiento"]').innerText()).includes('consulta las figuras D.1 y E.2 del CTE DB SE-AE'));
  comprobar('sin tabla de municipios: su campo no aparece', !(await p.isVisible('#municipio')));
  comprobar('zonas eólicas A, B, C y zonas invernales 1-7', (await p.locator('#zona-eolica option').count()) === 4 && (await p.locator('#zona-invierno option').count()) === 8);
  comprobar('51 capitales de la tabla 3.8', (await p.locator('#capital-cte option').count()) === 52);
  await p.selectOption('#zona-eolica', 'B');
  comprobar('zona B: 97,2 km/h, «CTE»', await p.inputValue('#viento') === '97.2' && await origen('viento') === 'CTE');
  comprobar('sin zona invernal ni altitud: nieve vacía', await p.inputValue('#nieve') === '');
  await p.selectOption('#zona-invierno', '4');
  await p.fill('#altitud', '650');
  comprobar('zona 4 a 650 m: 56 kg/m² (0,55 kN/m²), «CTE, tabla E.2»', await p.inputValue('#nieve') === '56' && await origen('nieve') === 'CTE, tabla E.2', await p.inputValue('#nieve'));
  const t1 = await info();
  comprobar('datos: vb, qb, ce y sk', /27 m\/s/.test(t1) && /0,45 kN\/m²/.test(t1) && /ce/.test(t1) && /0,55 kN\/m²/.test(t1), t1);
  comprobar('aptitud: viento no apto (97,2 > 94), nieve sin dato', /No apto/.test(await p.locator('#aptitud-modelos').innerText()) && /sin dato/.test(await p.locator('#aptitud-modelos').innerText()));

  // ---------- 2. Fuera de tabla ----------
  console.log('2. Fuera de tabla');
  await p.selectOption('#zona-invierno', '1');
  await p.fill('#altitud', '1700');
  comprobar('zona 1 a 1700 m: fuera de tabla, requiere estudio', /fuera de tabla, requiere estudio/.test(await info()) && /1600 m/.test(await info()) && await p.inputValue('#nieve') === '');
  comprobar('aptitud: «fuera de tabla, requiere estudio»', /fuera de tabla, requiere estudio/.test(await p.locator('#aptitud-modelos').innerText()));
  await irA(p, 'revision');
  comprobar('Revisión: aviso de nieve fuera de tabla', (await p.locator('#summary .avisos').innerText()).includes('fuera de la tabla E.2'));
  await irA(p, 'emplazamiento');
  await p.fill('#altitud', '1600');
  comprobar('a 1600 m (última con dato) sí hay valor: 4,3 kN/m² = 438 kg/m²', await p.inputValue('#nieve') === '438', await p.inputValue('#nieve'));

  // ---------- 3. Capital ----------
  console.log('3. Capital de la tabla 3.8');
  await p.selectOption('#capital-cte', 'León');
  comprobar('León: altitud 820 m y 1,2 kN/m² = 122 kg/m², «CTE, tabla 3.8»', await p.inputValue('#altitud') === '820' && await p.inputValue('#nieve') === '122' && await origen('nieve') === 'CTE, tabla 3.8', `${await p.inputValue('#altitud')} ${await p.inputValue('#nieve')}`);
  comprobar('con capital, la zona invernal no se usa', await p.isDisabled('#zona-invierno'));
  comprobar('el viento sigue la zona eólica elegida', await p.inputValue('#viento') === '97.2');
  await p.fill('#altitud', '900');
  comprobar('cambiar la altitud vuelve a zona + altitud (zona 1 a 900 m: 1,4 kN/m²)', await p.inputValue('#capital-cte') === '' && await p.inputValue('#nieve') === '143', await p.inputValue('#nieve'));
  await p.selectOption('#capital-cte', 'León');

  // ---------- 4. A mano ----------
  console.log('4. A mano');
  await p.fill('#viento', '80');
  comprobar('viento escrito: «manual»', await origen('viento') === 'manual' && await origen('nieve') === 'CTE, tabla 3.8');
  comprobar('botón para volver a los del CTE', await p.isVisible('#btn-cargas-municipio'));
  await p.selectOption('#categoria-terreno', 'III');
  comprobar('el manual no se pisa al cambiar otra cosa', await p.inputValue('#viento') === '80');
  await p.click('#btn-cargas-municipio');
  comprobar('«Usar los valores del CTE» los devuelve', await p.inputValue('#viento') === '97.2' && await origen('viento') === 'CTE' && !(await p.isVisible('#btn-cargas-municipio')));
  await p.fill('#nieve', '150');

  // ---------- 5. Categoría y pendiente ----------
  console.log('5. Categoría de terreno y pendiente');
  comprobar('explicación de la categoría', (await p.locator('#categoria-explicacion').innerText()).startsWith('Llana o accidentada'));
  const ceIII = (await info()).match(/ce ([\d,]+)/);
  await p.selectOption('#categoria-terreno', 'I');
  const ceI = (await info()).match(/ce ([\d,]+)/);
  comprobar('la categoría cambia ce (I > III)', ceI && ceIII && parseFloat(ceI[1].replace(',', '.')) > parseFloat(ceIII[1].replace(',', '.')));
  await p.selectOption('#categoria-terreno', 'III');
  await p.fill('#pendiente', '3');

  // ---------- 6. Propuesta ----------
  console.log('6. Propuesta');
  await irA(p, 'salidas');
  await p.click('#btn-propuesta');
  const prop = await p.locator('#propuesta-container').innerText();
  comprobar('tabla de cargas del sitio frente a las declaradas', /Cargas del sitio frente a las declaradas por el fabricante/i.test(prop));
  comprobar('viento de la zona B y nieve manual', /97,2 km\/h\s*CTE DB SE-AE, zona eólica B/.test(prop) && /150 kg\/m²\s*introducido a mano/.test(prop), prop.slice(prop.indexOf('Cargas del sitio'), prop.indexOf('Cargas del sitio') + 300));
  comprobar('zona, capital, altitud, categoría y pendiente', prop.includes('Capital de provincia: León (tabla 3.8)') && prop.includes('820 m') && prop.includes('III. Zona rural accidentada') && prop.includes('3 %'));
  comprobar('nota: no sustituye al cálculo estructural', prop.includes('no sustituye al cálculo estructural'));
  await p.click('#btn-cerrar-propuesta');

  // ---------- 7. Guardar y abrir ----------
  console.log('7. Guardar y abrir');
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#btn-guardar-proyecto')]);
  const archivo = path.join(dir, d.suggestedFilename());
  await d.saveAs(archivo);
  const json = JSON.parse(fs.readFileSync(archivo, 'utf8')).proyecto;
  comprobar('el archivo guarda el sitio', json.sitio.zona_eolica === 'B' && json.sitio.capital === 'León' && json.sitio.altitud === 820 && json.sitio.categoria === 'III' && json.sitio.pendiente === 3 && json.sitio.nieve_manual === true && json.nieve_kgm2 === 150);
  await p.goto(url);
  await p.setInputFiles('#archivo-proyecto', archivo);
  await p.waitForSelector('body.dialogo-abierto');
  await p.click('#btn-cerrar-dialogo');
  await irA(p, 'emplazamiento');
  comprobar('vuelven zonas, capital, altitud, valores y origen', await p.inputValue('#zona-eolica') === 'B' && await p.inputValue('#capital-cte') === 'León' && await p.inputValue('#altitud') === '820'
    && await p.inputValue('#viento') === '97.2' && await p.inputValue('#nieve') === '150' && await origen('nieve') === 'manual' && await origen('viento') === 'CTE');
  comprobar('vuelven categoría y pendiente', await p.inputValue('#categoria-terreno') === 'III' && await p.inputValue('#pendiente') === '3');
  await p.context().close();

  // ---------- 8. Con tabla de municipios ----------
  console.log('8. Con tabla de municipios (inventada)');
  const q = await nueva(true);
  await irA(q, 'emplazamiento');
  comprobar('con tabla, aparece el campo de municipio', await q.isVisible('#municipio') && await q.locator('#lista-municipios option').count() === 4);
  await q.fill('#municipio', 'Sierra de Ensayo (Provincia de Ensayo)');
  await q.press('#municipio', 'Tab');
  comprobar('el municipio rellena zonas y altitud (C, 3, 1100 m)', await q.inputValue('#zona-eolica') === 'C' && await q.inputValue('#zona-invierno') === '3' && await q.inputValue('#altitud') === '1100');
  comprobar('y da viento 104,4 km/h y nieve 92 kg/m²', await q.inputValue('#viento') === '104.4' && await q.inputValue('#nieve') === '92');
  await q.fill('#municipio', 'Villaprueba');
  await q.press('#municipio', 'Tab');
  comprobar('nombre repetido en dos provincias: pide elegir', (await q.locator('#sitio-info').innerText()).includes('no está en la tabla'));
  const gml = fs.readFileSync(path.join(DATOS, 'parcela_irregular.gml'), 'utf8').split('00000X00000000').join('99103A001000010000XX');
  await q.setInputFiles('#archivo-parcela', { name: 'rustica.gml', mimeType: 'text/xml', buffer: Buffer.from(gml) });
  await q.waitForSelector('.parcela-cargada');
  comprobar('la parcela de rústica trae el municipio: Llanos de Prueba (B, 4, 650 m)', await q.inputValue('#municipio') === 'Llanos de Prueba (Provincia de Ensayo)' && await q.inputValue('#zona-eolica') === 'B' && await q.inputValue('#altitud') === '650' && await q.inputValue('#nieve') === '56');
  await q.selectOption('#zona-eolica', 'A');
  comprobar('cambiar una zona a mano deja de usar el municipio', await q.inputValue('#municipio') === '' && await q.inputValue('#viento') === '93.6');

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
