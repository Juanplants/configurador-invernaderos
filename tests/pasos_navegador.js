// ============================================================
// Flujo de 6 pasos en la app real (Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/pasos_navegador.js   (necesita Playwright; si no, se omite)
// 1. Un paso visible a la vez; barra de pasos con los no visitados desactivados;
//    Anterior / Siguiente; saltar a un paso visitado.
// 2. Cada control de la pantalla anterior sigue existiendo, en su paso, y se ve
//    y funciona al ir a ese paso (nada se pierde).
// 3. El plano se ve en todos los pasos; el resumen corto y la marca de avisos.
// 4. Abrir un proyecto deja ir a cualquier paso.

const path = require('path');
const fs = require('fs');
const os = require('os');
const PASOS = require('../js/pasos.js');

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

// Dónde va cada control (apartado 2 de la especificación y encargo de la fase)
const CONTROLES = {
  proyecto: ['#codigo-proyecto', '#cliente', '#ubicacion', '#btn-abrir-proyecto'],
  emplazamiento: ['#zona', '#viento', '#btn-cargar-parcela', '#parcela-largo', '#parcela-ancho', '#parcela-orientacion', '#parcela-girado', '#retranqueo', '#camino', '#orientacion-preferida', '#aptitud-modelos'],
  geometria: ['#model-select', '#num-naves', '#ancho-nave', '#num-tramos', '#separacion', '#altura-canal', '#perfil', '#btn-optimizar'],
  envolvente: ['#opciones [data-grupo="ventilacion_cenital"]', '#puertas'],
  revision: ['#summary .summary-grid', '#summary .avisos', '#materiales .tabla-materiales', '#btn-ver-calculo'],
  salidas: ['#btn-pdf-todos', '#btn-pdf-hoja', '#btn-propuesta', '#btn-excel', '#btn-guardar-proyecto']
};

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pasos-'));
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errores = [], externas = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => m.type() === 'error' && errores.push(m.text()));
  p.on('request', r => { if (!/^(file|blob|data):/.test(r.url())) externas.push(r.url()); });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await p.goto(url);
  const actual = () => p.locator('.paso-boton.actual').getAttribute('data-ir');
  const visibles = () => p.$$eval('section.paso', ss => ss.filter(s => s.offsetParent !== null).map(s => s.dataset.paso));

  // ---------- 1. Navegación ----------
  console.log('1. Un paso a la vez');
  comprobar('empieza en Proyecto', await actual() === 'proyecto');
  comprobar('solo se ve el paso actual', JSON.stringify(await visibles()) === '["proyecto"]', JSON.stringify(await visibles()));
  comprobar('barra: 6 pasos en orden', JSON.stringify(await p.$$eval('.paso-boton', bs => bs.map(b => b.dataset.ir))) === JSON.stringify(PASOS.LISTA));
  comprobar('pasos no visitados desactivados', await p.locator('.paso-boton:disabled').count() === 5);
  comprobar('Anterior desactivado en el primero', await p.isDisabled('#btn-anterior'));
  comprobar('Siguiente dice a dónde va', (await p.locator('#btn-siguiente').innerText()).includes('Emplazamiento'));
  await p.locator('.paso-boton[data-ir="revision"]').click({ force: true });
  comprobar('pulsar un paso sin visitar no cambia', await actual() === 'proyecto');
  for (let i = 1; i < PASOS.LISTA.length; i++) {
    await p.click('#btn-siguiente');
    const paso = PASOS.LISTA[i];
    comprobar(`Siguiente → ${PASOS.NOMBRES[paso]}`, await actual() === paso && JSON.stringify(await visibles()) === JSON.stringify([paso]), `${await actual()} ${JSON.stringify(await visibles())}`);
    comprobar(`${PASOS.NOMBRES[paso]}: «Paso ${i + 1} de 6»`, (await p.locator('#paso-actual').innerText()) === `Paso ${i + 1} de 6`);
    comprobar(`${PASOS.NOMBRES[paso]}: el plano se ve`, await p.isVisible('#plan') && await p.isVisible('.tabs') && (await p.locator('#plan').innerHTML()).length > 1000);
  }
  comprobar('en Salidas no hay Siguiente', !(await p.isVisible('#btn-siguiente')));
  comprobar('todos visitados', await p.locator('.paso-boton:disabled').count() === 0);
  await p.click('#btn-anterior');
  comprobar('Anterior → Revisión', await actual() === 'revision');
  await p.click('.paso-boton[data-ir="emplazamiento"]');
  comprobar('saltar a un paso visitado desde la barra', await actual() === 'emplazamiento' && JSON.stringify(await visibles()) === '["emplazamiento"]');
  await p.click('.paso-boton[data-ir="salidas"]');
  comprobar('y hacia delante', await actual() === 'salidas');

  // ---------- 2. Nada se pierde ----------
  console.log('2. Cada control en su paso');
  for (const [paso, selectores] of Object.entries(CONTROLES)) {
    await p.click(`.paso-boton[data-ir="${paso}"]`);
    for (const sel of selectores) {
      const enPaso = await p.locator(`section.paso[data-paso="${paso}"] ${sel}`).count();
      comprobar(`${PASOS.NOMBRES[paso]}: ${sel}`, enPaso >= 1 && await p.locator(`section.paso[data-paso="${paso}"] ${sel}`).first().isVisible(), `${enPaso}`);
    }
  }
  // Algunos funcionan de verdad desde su paso
  await p.click('.paso-boton[data-ir="geometria"]');
  await p.fill('#num-naves', '5');
  comprobar('Geometría: cambiar naves cambia el plano y el resumen', (await p.locator('#resumen-corto').innerText()).includes('5 × 8 m'));
  await p.click('.paso-boton[data-ir="envolvente"]');
  await p.selectOption('[data-grupo="ventilacion_cenital"]', 'C21');
  await p.click('.paso-boton[data-ir="revision"]');
  comprobar('Revisión: la lista de materiales recoge la mariposa', (await p.locator('.tabla-materiales').innerText()).includes('mariposa'));
  await p.click('#btn-ver-calculo');
  comprobar('Revisión: «ver cálculo» sigue funcionando', (await p.locator('.tabla-materiales th').allInnerTexts()).includes('Cálculo'));
  await p.click('.paso-boton[data-ir="salidas"]');
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#btn-excel')]);
  comprobar('Salidas: el Excel se descarga', /_materiales_\d{4}-\d{2}-\d{2}\.xlsx$/.test(d.suggestedFilename()), d.suggestedFilename());
  const [g] = await Promise.all([p.waitForEvent('download'), p.click('#btn-guardar-proyecto')]);
  const guardado = path.join(dir, g.suggestedFilename());
  await g.saveAs(guardado);
  comprobar('Salidas: el proyecto se guarda', fs.existsSync(guardado));
  await p.click('#btn-propuesta');
  comprobar('Salidas: la propuesta se abre', await p.isVisible('#propuesta-container') && (await p.locator('#propuesta-container').innerText()).length > 500);
  await p.click('#btn-cerrar-propuesta');
  // Las pestañas del plano siguen en cualquier paso
  await p.click('.tab[data-vista="seccion"]');
  comprobar('pestañas del plano desde Salidas', (await p.locator('#plan').innerHTML()).includes('SECCI'));

  // ---------- 3. Resumen corto y avisos ----------
  console.log('3. Resumen y avisos');
  const resumen = await p.locator('#resumen-corto').innerText();
  comprobar('resumen corto con superficie y €/m²', /m²/.test(resumen) && /€\/m²/.test(resumen), resumen);
  const marca = await p.locator('#marca-avisos').innerText();
  const avisos = await p.locator('#summary .avisos .aviso.rojo, #summary .avisos .aviso.ambar').count();
  comprobar('marca de avisos en «Revisión» = avisos rojos y ámbar', (+marca || 0) === avisos, `${marca} vs ${avisos}`);
  await p.click('.paso-boton[data-ir="emplazamiento"]');
  await p.fill('#viento', '100');
  comprobar('aptitud de cada modelo al poner el viento', (await p.locator('#aptitud-modelos').innerText()).includes('No apto'));
  await p.fill('#viento', '');

  // ---------- 4. Abrir un proyecto ----------
  console.log('4. Abrir un proyecto');
  await p.goto(url);
  comprobar('pantalla nueva: paso 1 y el resto sin visitar', await actual() === 'proyecto' && await p.locator('.paso-boton:disabled').count() === 5);
  await p.setInputFiles('#archivo-proyecto', guardado);
  await p.waitForSelector('body.dialogo-abierto');
  await p.click('#btn-cerrar-dialogo');
  comprobar('proyecto abierto: todos los pasos accesibles', await p.locator('.paso-boton:disabled').count() === 0);
  await p.click('.paso-boton[data-ir="envolvente"]');
  comprobar('y con sus datos', await p.inputValue('[data-grupo="ventilacion_cenital"]') === 'C21');

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
