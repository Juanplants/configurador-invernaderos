// Junta la normativa (datos/cte_se_ae.json) y la tabla de municipios
// (datos/municipios_cte.csv) en datos/municipios.js, que la app carga sin
// internet (doble clic: el navegador no deja leer archivos sueltos).
// Uso:  node herramientas/municipios_a_js.js [csv] [json] [salida]
// Valida con el mismo código que la app (js/sitio.js) y se detiene si hay errores.
const fs = require('fs');
const path = require('path');
const SITIO = require('../js/sitio.js');

const raiz = path.resolve(__dirname, '..');
const [csvRuta = path.join(raiz, 'datos/municipios_cte.csv'), jsonRuta = path.join(raiz, 'datos/cte_se_ae.json'), salida = path.join(raiz, 'datos/municipios.js')] = process.argv.slice(2);
const normativa = JSON.parse(fs.readFileSync(jsonRuta, 'utf8'));
const csv = SITIO.leerCSV(fs.readFileSync(csvRuta, 'utf8'));
const errores = SITIO.validarNormativa(normativa).concat(csv.errores);
if (errores.length) {
  console.error(`${errores.length} errores:\n  ${errores.slice(0, 50).join('\n  ')}`);
  process.exit(1);
}
const meta = { archivo: path.basename(csvRuta), fecha: fs.statSync(csvRuta).mtime.toISOString().slice(0, 10), total: csv.municipios.length };
const datos = SITIO.empaquetar(normativa, csv, meta);
fs.writeFileSync(salida, '// Generado por herramientas/municipios_a_js.js: no editar a mano.\n'
  + `// Normativa: ${normativa.fuente}\n// Estado: ${normativa.estado}\n`
  + `window.SITIO_DATOS = ${JSON.stringify(datos)};\n`);
console.log(`${path.relative(raiz, salida)}: ${csv.municipios.length} municipios; nieve ${'tabla E.2 y ' + normativa.capitales.lista.length + ' capitales'}`);
