// ============================================================
// Planos en navegador: los textos reales caben en sus cajas
// ============================================================
// Ejecutar:  node tests/planos_navegador.js   (necesita Playwright)
// tests/planos.js demuestra que las cajas del registro no se solapan; esta
// prueba dibuja las mismas hojas en Chromium y comprueba que cada texto
// real (con la fuente que haya en el sistema) queda dentro de su caja.
// Si no hay Playwright, se omite sin fallar.

const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (_) {
  try {
    const global = require('child_process').execSync('npm root -g').toString().trim();
    ({ chromium } = require(path.join(global, 'playwright')));
  } catch (__) {
    console.log('Playwright no está instalado: prueba omitida.');
    process.exit(0);
  }
}

const PLANTA = require('../js/planos/planta.js');
const GEO = require('../js/motor/geometria.js');
const catalogo = require('../datos/catalogo-ejemplo.json');
const PROYECTO = { cliente: 'Explotación Agrícola Hermanos Martínez Fernández', codigo: '26JD001', ubicacion: 'Paraje Los Llanos, El Ejido (Almería)' };
const PX = 10; // px por mm (a menos resolución Chromium redondea las cajas al píxel)

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 420 * PX, height: 297 * PX } });
  let fallos = 0, ok = 0;
  for (const modelo of catalogo.modelos) {
    for (const naves of [1, 2, 5, 10]) {
      for (const tramos of [10, 20, 60]) {
        const g = GEO.calcular(modelo, { naves, tramos });
        const h = PLANTA.planta({ g, modelo, empresa: catalogo.empresa, proyecto: PROYECTO, fecha: '28/09/2026' });
        await pagina.setContent(`<body style="margin:0"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="${420 * PX}" height="${297 * PX}" viewBox="${h.viewBox}">${h.svg}</svg></body>`);
        const reales = await pagina.evaluate((px) => {
          const s = document.getElementById('s').getBoundingClientRect();
          return [...document.querySelectorAll('text[data-caja]')].map(t => {
            const r = t.getBoundingClientRect();
            return { i: +t.dataset.caja, texto: t.textContent, x: (r.left - s.left) / px, y: (r.top - s.top) / px, w: r.width / px, h: r.height / px };
          });
        }, PX);
        const malos = reales.filter(r => {
          const c = h.cajas[r.i], tol = 0.01;
          return r.x < c.x - tol || r.y < c.y - tol || r.x + r.w > c.x + c.w + tol || r.y + r.h > c.y + c.h + tol;
        });
        const nombre = `${modelo.id} ${naves}×${tramos}: ${reales.length} textos`;
        if (malos.length) {
          fallos++;
          console.log(`  ✗ ${nombre}; se salen de su caja: ${malos.slice(0, 5).map(m => { const c = h.cajas[m.i]; return `"${m.texto}" (real x${m.x.toFixed(2)} y${m.y.toFixed(2)} w${m.w.toFixed(2)} h${m.h.toFixed(2)} · caja x${c.x.toFixed(2)} y${c.y.toFixed(2)} w${c.w.toFixed(2)} h${c.h.toFixed(2)})`; }).join(', ')}`);
        } else ok++;
      }
    }
  }
  await navegador.close();
  console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
  process.exit(fallos ? 1 : 0);
})();
