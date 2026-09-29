// Cambiar SheetJS (lib/xlsx.mini.min.js) por otra versión, comprobándola antes.
// Uso:  node herramientas/cambiar_sheetjs.js ruta/al/xlsx.mini.min.js
//
// 1. Carga el archivo nuevo y dice su versión y su huella (sha512, para lib/LEEME.md).
// 2. Pasa con él, sin tocar lib/, las pruebas que usan SheetJS en node:
//    importación del catálogo, Excel de materiales y catálogo de la hoja Modelos.
// 3. Si pasan, lo copia a lib/ (guardando el anterior) y pasa las pruebas en
//    Chromium que leen y escriben Excel en la app. Si alguna falla, deja el
//    anterior como estaba.
// Termina con 0 si todo va bien y deja el nuevo en lib/.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
const destino = path.join(raiz, 'lib', 'xlsx.mini.min.js');
const nuevo = process.argv[2] && path.resolve(process.argv[2]);
if (!nuevo || !fs.existsSync(nuevo)) {
  console.error('Uso: node herramientas/cambiar_sheetjs.js ruta/al/xlsx.mini.min.js');
  process.exit(2);
}

// 1. Versión y huella
let version;
try {
  version = require(nuevo).version;
} catch (e) {
  console.error(`No se puede cargar ${nuevo}: ${e.message}`);
  process.exit(1);
}
const contenido = fs.readFileSync(nuevo);
const sha512 = 'sha512-' + crypto.createHash('sha512').update(contenido).digest('base64');
const actual = require(destino).version;
console.log(`Actual: SheetJS ${actual}. Nuevo: SheetJS ${version} (${(contenido.length / 1024).toFixed(0)} kB).`);
console.log(`Huella del nuevo: ${sha512}`);
for (const f of ['read', 'write', 'writeFile']) {
  if (typeof require(nuevo)[f] !== 'function') { console.error(`Al archivo nuevo le falta XLSX.${f}: ¿es la versión «mini» completa?`); process.exit(1); }
}

const pasar = (prueba, env = {}) => {
  const r = spawnSync(process.execPath, [path.join(raiz, 'tests', prueba)], { env: Object.assign({}, process.env, env), encoding: 'utf8' });
  const ultima = (r.stdout || '').trim().split('\n').pop();
  console.log(`  ${prueba}: ${ultima}${r.status ? ' ✗' : ''}`);
  if (r.status) console.log((r.stdout || '').split('\n').filter(l => l.includes('✗')).slice(0, 10).join('\n') + (r.stderr ? '\n' + r.stderr.slice(0, 800) : ''));
  return r.status === 0;
};

// 2. Pruebas en node con el archivo nuevo (lib/ sin tocar)
console.log('Pruebas en node con el archivo nuevo:');
const node = ['importacion.js', 'salidas.js', 'sitio.js'].map(p => pasar(p, { XLSX_LIB: nuevo })).every(Boolean);
if (!node) { console.error('Fallan pruebas: no se cambia lib/xlsx.mini.min.js.'); process.exit(1); }

// 3. Copia y pruebas en Chromium (la app carga lib/xlsx.mini.min.js)
const copia = destino + '.anterior';
fs.copyFileSync(destino, copia);
fs.copyFileSync(nuevo, destino);
console.log('Pruebas en Chromium con el archivo nuevo en lib/:');
const navegador = ['salidas_navegador.js', 'pasos_navegador.js'].map(p => pasar(p)).every(Boolean);
if (!navegador) {
  fs.copyFileSync(copia, destino);
  fs.unlinkSync(copia);
  console.error('Fallan pruebas en Chromium: se deja la versión anterior.');
  process.exit(1);
}
fs.unlinkSync(copia);
console.log(`\nHecho: lib/xlsx.mini.min.js es ahora SheetJS ${version}.`);
console.log('Falta actualizar la fila de lib/LEEME.md con la versión, el origen y la huella de arriba.');
