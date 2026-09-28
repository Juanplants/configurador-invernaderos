// ============================================================
// Terreno y optimizador en la app real (Chromium, sin internet)
// ============================================================
// Ejecutar:  node tests/terreno_navegador.js   (necesita Playwright; si no, se omite)
// 1. Cargar el GML y el KML de la parcela de ejemplo (inventada); un archivo malo avisa.
// 2. Buscar las 3 mejores: coinciden con el optimizador en node; el perfil cambia la puntuación.
// 3. Elegir una: rellena la geometría y el plano de emplazamiento dibuja el polígono;
//    el PDF de planos lleva las 5 hojas.
// 4. Guardar y abrir el proyecto conserva la parcela y la implantación.
// 5. Quitar la parcela vuelve al rectángulo a mano, con el que también se optimiza.

const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const PAR = require('../js/terreno/parcela.js');
const OPT = require('../js/terreno/optimizador.js');
const CROQUIS = require('../js/terreno/croquis.js');
const { irA } = require('./navegador_pasos.js');
const catalogo = require('../datos/catalogo-ejemplo.json');

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
const numero = (t) => parseFloat(String(t).replace(/\./g, '').replace(',', '.'));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terreno-'));
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
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
    return destino;
  };
  const plano = () => p.locator('#plan').innerHTML();
  const buscar = async () => {
    await irA(p, 'geometria');
    await p.evaluate(() => { document.getElementById('optimizador').innerHTML = ''; });
    await p.click('#btn-optimizar');
    await p.waitForSelector('.candidata', { timeout: 30000 });
  };

  // ---------- 1. Cargar la parcela ----------
  console.log('1. Cargar la parcela del Catastro');
  await irA(p, 'emplazamiento');
  await p.setInputFiles('#archivo-parcela', { name: 'nota.gml', mimeType: 'text/xml', buffer: Buffer.from('<FeatureCollection></FeatureCollection>') });
  await p.waitForSelector('#parcela-info .aviso.rojo');
  comprobar('archivo sin polígono: aviso en rojo', (await p.locator('#parcela-info').innerText()).includes('ningún polígono'));
  await p.fill('#camino', '4'); // otro render: el aviso sigue
  comprobar('el aviso se mantiene al seguir editando', await p.locator('#parcela-info .aviso.rojo').count() === 1);

  await p.setInputFiles('#archivo-parcela', path.join(DATOS, 'parcela_irregular.kml'));
  await p.waitForSelector('.parcela-cargada');
  const areaKml = numero((await p.locator('.parcela-cargada').innerText()).match(/([\d.]+) m²/)[1]);
  await p.setInputFiles('#archivo-parcela', path.join(DATOS, 'parcela_irregular.gml'));
  await p.waitForSelector('.parcela-cargada');
  const info = await p.locator('.parcela-cargada').innerText();
  const gml = PAR.leer(fs.readFileSync(path.join(DATOS, 'parcela_irregular.gml'), 'utf8'), 'parcela_irregular.gml');
  comprobar('muestra la referencia y la superficie', info.includes('00000X00000000') && info.includes(`${Math.round(gml.meta.area).toLocaleString('es-ES')} m²`) && info.includes('8 vértices'), info);
  comprobar('KML y GML: misma superficie', areaKml === Math.round(gml.meta.area), `${areaKml}`);
  comprobar('sin aviso rojo tras cargar bien', await p.locator('#parcela-info .aviso.rojo').count() === 0);
  comprobar('oculta el rectángulo a mano', !(await p.isVisible('#parcela-largo')) && !(await p.isVisible('#parcela-orientacion')));
  comprobar('pasa a la hoja de emplazamiento', await p.locator('.tab.active').getAttribute('data-vista') === 'emplazamiento');
  const antes = await plano();
  comprobar('el emplazamiento dibuja la parcela del Catastro', antes.includes('Parcela del Catastro (ref. catastral 00000X00000000)') && antes.includes('fill-rule="evenodd"'));

  // ---------- 2. Optimizador ----------
  console.log('2. Las 3 mejores');
  await buscar();
  const tarjetas = await p.locator('.candidata').allInnerTexts();
  comprobar('3 tarjetas con croquis', tarjetas.length === 3 && await p.locator('.candidata svg.croquis path').count() >= 6);
  const ref = OPT.buscar({ anillos: gml.anillos, catalogo, holgura: 4, perfil: 'equilibrado', base: { seleccion: {}, opcionales: [], puertas: 1, zona: 'Almería' } });
  // La pantalla lleva la selección y la zona por defecto del catálogo; se comparan medidas y superficie
  ref.mejores.forEach((c, i) => {
    const t = tarjetas[i] || '';
    comprobar(`tarjeta ${i + 1}: ${c.modelo.nombre} ${c.ventana.nombre} ${c.naves} × ${c.tramos}`, t.includes(c.modelo.nombre) && t.includes(c.ventana.nombre) && t.includes(`${c.naves} × ${c.tramos}`) && t.includes(`${Math.round(c.area).toLocaleString('es-ES')} m²`), t.replace(/\n/g, ' | '));
    for (const k of ['Superficie', 'Precio', 'Ventilación', 'Orientación', 'Ventana cenital']) comprobar(`tarjeta ${i + 1}: muestra ${k}`, t.includes(k));
  });
  comprobar('ninguna tarjeta en rojo de ventilación', await p.locator('.candidata.en-rojo').count() === 0);
  comprobar('3 tarjetas distintas en modelo o ventana', new Set(tarjetas.map(t => t.split('\n').slice(0, 1).join() + '|' + (t.match(/Ventana cenital\s+(.+)/) || [])[1])).size === 3);
  comprobar('cabecera con el perfil y sus pesos', (await p.locator('#optimizador h3').innerText()).includes('Equilibrado: coste 40 %'));
  await p.selectOption('#perfil', 'clima');
  await p.waitForFunction(() => document.querySelector('#optimizador h3') && document.querySelector('#optimizador h3').innerText.includes('Clima'), null, { timeout: 30000 });
  comprobar('otro perfil: vuelve a puntuar con sus pesos', (await p.locator('#optimizador h3').innerText()).includes('ventilación 40 %'));

  // ---------- 3. Elegir ----------
  console.log('3. Elegir una');
  const clima = OPT.buscar({ anillos: gml.anillos, catalogo, holgura: 4, perfil: 'clima', base: { seleccion: {}, opcionales: [], puertas: 1, zona: 'Almería' } });
  const c = clima.mejores[1];
  await p.click('[data-elegir="1"]');
  comprobar('rellena modelo, naves y tramos', await p.inputValue('#model-select') === c.modelo.id && +(await p.inputValue('#num-naves')) === c.naves && +(await p.inputValue('#num-tramos')) === c.tramos,
    `${await p.inputValue('#model-select')} ${await p.inputValue('#num-naves')} × ${await p.inputValue('#num-tramos')}`);
  comprobar('rellena la ventana cenital', await p.inputValue('[data-grupo="ventilacion_cenital"]') === c.ventana.id, await p.inputValue('[data-grupo="ventilacion_cenital"]'));
  comprobar('rellena ancho de nave y separación', Math.abs(+(await p.inputValue('#ancho-nave')) - c.ancho_nave) < 1e-9 && Math.abs(+(await p.inputValue('#separacion')) - c.separacion) < 1e-9);
  comprobar('tarjeta marcada como elegida', (await p.locator('.candidata.elegida').count()) === 1 && (await p.locator('.candidata.elegida').innerText()).includes('Elegida'));
  const resumen = await p.locator('.summary-grid').textContent();
  comprobar('el resumen tiene la superficie elegida', resumen.includes(`${Math.round(c.area).toLocaleString('es-ES')} m²`), resumen);
  comprobar('sin aviso de que no cabe', !(await p.locator('#summary .avisos').textContent()).includes('no cabe'));
  const elegido = await plano();
  const dist = elegido.match(/Distancia mínima al lindero ([\d.,]+) m \(exigida 4,00 m\)/);
  comprobar('plano: distancia mínima exigida cumplida', dist && numero(dist[1]) >= 4, dist && dist[0]);
  comprobar('plano: medidas del invernadero elegido', elegido.includes(`${c.naves} × `) && !elegido.includes('NO CABE') && !elegido.includes('NO CUMPLE'));
  // Misma orientación en el croquis de la tarjeta y en el plano (norte arriba en los dos)
  const anguloCroquis = CROQUIS.anguloInvernadero(await p.locator('.candidata.elegida svg.croquis').evaluate(el => el.outerHTML));
  const anguloPlano = CROQUIS.anguloInvernadero(elegido);
  const giroHoja = +((elegido.match(/rotate\((\d+(?:\.\d+)?)\)"><path d="M0,-5/) || [])[1] || 0);
  const dif = ((anguloPlano - giroHoja - anguloCroquis) % 180 + 180) % 180;
  comprobar('croquis y plano: el invernadero con la misma orientación', Math.min(dif, 180 - dif) < 0.01, `croquis ${anguloCroquis}°, plano ${anguloPlano}°, hoja ${giroHoja}°`);
  comprobar('plano: norte arriba (hoja sin girar)', giroHoja === 0);
  // La planta lleva el norte de la implantación
  await p.click('.tab[data-vista="planta"]');
  comprobar('la planta dibuja el norte', (await plano()).includes('>N<'));
  await p.click('.tab[data-vista="emplazamiento"]');
  // Cambiar a mano las naves: se vuelve a encajar o se avisa
  await p.fill('#num-naves', '40');
  comprobar('más naves de las que caben: aviso', (await p.locator('#summary .avisos').textContent()).includes('no cabe en la parcela del Catastro'));
  comprobar('y el plano lo dice', (await plano()).includes('EL INVERNADERO NO CABE EN LA PARCELA'));
  comprobar('la tarjeta ya no está elegida', await p.locator('.candidata.elegida').count() === 0);
  await p.click('[data-elegir="1"]');
  await irA(p, 'salidas');
  const pdf = fs.readFileSync(await bajar('#btn-pdf-todos')).toString('latin1');
  const paginas = [...pdf.matchAll(/\/Type \/Page\b[\s\S]*?\/Contents (\d+) 0 R/g)].map(m => +m[1]);
  const contenido = (n) => { const m = pdf.match(new RegExp(`(?:^|\\n)${n} 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)endstream`)); try { return zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch (_) { return m ? m[1] : ''; } };
  comprobar('PDF de planos: 5 hojas, la última el emplazamiento', paginas.length === 5 && contenido(paginas[4]).includes('(EMPLAZAMIENTO) Tj') && contenido(paginas[4]).includes('Parcela del Catastro'), `${paginas.length}`);

  // Orientación preferida este-oeste: vuelve a buscar y las cumbreras van a 90°
  await irA(p, 'emplazamiento');
  await p.selectOption('#orientacion-preferida', 'este_oeste');
  await irA(p, 'geometria');
  await p.waitForFunction(() => document.querySelector('#optimizador h3') && document.querySelector('#optimizador h3').innerText.includes('este-oeste'), null, { timeout: 30000 });
  const eo = OPT.buscar({ anillos: gml.anillos, catalogo, holgura: 4, perfil: 'clima', orientacion: 'este_oeste', base: { seleccion: {}, opcionales: [], puertas: 1, zona: 'Almería' } });
  const textosEo = await p.locator('.candidata').allInnerTexts();
  comprobar('este-oeste: las tarjetas coinciden con el optimizador', eo.mejores.every((x, i) => (textosEo[i] || '').includes(`${x.azimut}°`) && (textosEo[i] || '').includes(`${x.naves} × ${x.tramos}`)), textosEo.map(t => t.replace(/\n/g, ' | ')).join(' // '));
  await p.click('[data-elegir="0"]');
  const planoEo = await plano();
  comprobar('este-oeste: plano con la cumbrera de la elegida', Math.abs(CROQUIS.anguloInvernadero(planoEo) - eo.mejores[0].azimut % 180) < 0.01, `${CROQUIS.anguloInvernadero(planoEo)}`);

  // ---------- 4. Guardar y abrir ----------
  console.log('4. Guardar y abrir el proyecto');
  await irA(p, 'emplazamiento');
  await p.fill('#retranqueo', '5');
  const hojaGuardada = await plano();
  await irA(p, 'salidas');
  const archivo = await bajar('#btn-guardar-proyecto');
  const json = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  comprobar('el proyecto guarda la parcela, la implantación y los retranqueos', json.proyecto.terreno && json.proyecto.terreno.anillos[0].length === 8
    && json.proyecto.terreno.implantacion && json.proyecto.retranqueo === 5 && json.proyecto.camino === 4 && json.proyecto.perfil === 'clima' && json.proyecto.orientacion_preferida === 'este_oeste');
  await p.goto(url);
  comprobar('pantalla nueva: sin parcela', await p.locator('.parcela-cargada').count() === 0);
  await p.setInputFiles('#archivo-proyecto', archivo);
  await p.waitForSelector('body.dialogo-abierto');
  await p.click('#btn-cerrar-dialogo');
  comprobar('vuelve la parcela', (await p.locator('.parcela-cargada').textContent()).includes('00000X00000000'));
  comprobar('vuelven retranqueo, perfil y orientación', await p.inputValue('#retranqueo') === '5' && await p.inputValue('#perfil') === 'clima' && await p.inputValue('#orientacion-preferida') === 'este_oeste');
  const norm = (s) => s.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '');
  comprobar('mismo plano de emplazamiento', norm(await plano()) === norm(hojaGuardada));

  // ---------- 5. Quitar la parcela ----------
  console.log('5. Parcela rectangular a mano');
  await irA(p, 'emplazamiento');
  await p.click('#btn-quitar-parcela');
  comprobar('vuelve el rectángulo a mano', await p.isVisible('#parcela-largo'));
  comprobar('sin parcela, el emplazamiento pide una', (await plano()).includes('Carga la parcela del Catastro'));
  await p.fill('#parcela-largo', '100'); await p.fill('#parcela-ancho', '60'); await p.fill('#parcela-orientacion', '0');
  await p.fill('#retranqueo', '7'); await p.fill('#camino', '0');
  await buscar();
  comprobar('rectángulo: 3 tarjetas', await p.locator('.candidata').count() === 3);
  await p.click('[data-elegir="0"]');
  comprobar('rectángulo: la elegida cabe', !(await p.locator('#summary .avisos').textContent()).includes('no cabe') && !(await plano()).includes('NO CABE'));
  await irA(p, 'emplazamiento');
  await p.fill('#parcela-largo', '');
  await irA(p, 'geometria');
  await p.click('#btn-optimizar');
  comprobar('sin parcela: pide una', (await p.locator('#optimizador').innerText()).includes('Carga la parcela'));

  comprobar('sin peticiones fuera del equipo', externas.length === 0, externas.join(', '));
  comprobar('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await navegador.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
