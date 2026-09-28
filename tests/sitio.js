// ============================================================
// Pruebas de las cargas del sitio por municipio (CTE DB SE-AE)
// ============================================================
// Ejecutar:  node tests/sitio.js
// Con municipios y tabla de nieve INVENTADOS (tests/datos/municipios_prueba.csv,
// tests/datos/cte_prueba.json): la tabla oficial la aporta el usuario.
// 1. Lectura de la tabla de municipios (CSV) y validación con filas y motivos.
// 2. Normativa: la del repositorio es válida y avisa de que la nieve está pendiente.
// 3. Cálculo: vb → km/h, ce de la categoría de terreno, nieve interpolada.
// 4. Búsqueda por nombre, por código INE y por la referencia catastral de rústica.
// 5. Apto / al límite / no apto (margen 10 %) y nieve sin dato del fabricante.
// 6. Propuesta: tabla de cargas del sitio frente a las declaradas, con la nota.
// 7. Proyecto: municipio, categoría, pendiente y valores manuales se guardan.
// 8. herramientas/municipios_a_js.js genera datos/municipios.js y rechaza errores.

const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { execFileSync } = require('child_process');
const SITIO = require('../js/sitio.js');
const AVI = require('../js/motor/avisos.js');
const MOTOR = require('../js/motor/motor.js');
const PROPUESTA = require('../js/propuesta.js');
const PROYECTO = require('../js/proyecto.js');
const catalogo = require('../datos/catalogo-ejemplo.json');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}
const DATOS = path.join(__dirname, 'datos');
const casi = (a, b, t = 1e-9) => Math.abs(a - b) < t;
const prueba = JSON.parse(fs.readFileSync(path.join(DATOS, 'cte_prueba.json'), 'utf8'));
const csv = SITIO.leerCSV(fs.readFileSync(path.join(DATOS, 'municipios_prueba.csv'), 'utf8'));

console.log('1. Tabla de municipios');
{
  comprobar('CSV de prueba sin errores', csv.errores.length === 0, csv.errores.join(' | '));
  comprobar('4 municipios (se saltan los comentarios)', csv.municipios.length === 4);
  const v = csv.municipios[0];
  comprobar('campos leídos', v.ine === '99001' && v.catastro === '99101' && v.nombre === 'Villaprueba' && v.altitud === 40 && v.zona_eolica === 'A' && v.zona_invierno === 6, JSON.stringify(v));
  const coma = SITIO.leerCSV('codigo_ine,codigo_catastro,provincia,municipio,altitud_m,zona_eolica,zona_invierno\n99001,,P,Uno,10,b,2\n');
  comprobar('también con «,» y zona en minúscula', coma.errores.length === 0 && coma.municipios[0].zona_eolica === 'B' && coma.municipios[0].catastro === '');
  const malo = SITIO.leerCSV([
    'codigo_ine;codigo_catastro;provincia;municipio;altitud_m;zona_eolica;zona_invierno',
    '9900;99101;P;Corto;10;A;1',
    '99002;99102;P;Zona mala;10;D;1',
    '99003;99103;P;Invierno malo;10;A;8',
    '99004;99104;P;Altitud mala;alta;A;1',
    '99005;99105;P;Bien;10;A;1',
    '99005;99106;P;Repetido;10;A;1'
  ].join('\n'));
  comprobar('errores con fila y motivo', malo.errores.length === 5 && malo.errores[0].startsWith('Fila 2') && malo.errores[1].includes('zona eólica') && malo.errores[2].includes('invierno') && malo.errores[3].includes('altitud') && malo.errores[4].includes('repetido'), malo.errores.join(' | '));
  comprobar('las filas buenas se leen igual', malo.municipios.length === 1 && malo.municipios[0].nombre === 'Bien');
  const sinCol = SITIO.leerCSV('codigo_ine;municipio\n99001;X');
  comprobar('faltan columnas: error que las nombra', sinCol.errores.length === 1 && sinCol.errores[0].includes('zona_eolica'));
  const plantilla = SITIO.leerCSV(fs.readFileSync(path.join(__dirname, '..', 'datos', 'municipios_cte.csv'), 'utf8'));
  comprobar('la plantilla del repositorio tiene las columnas', plantilla.errores.length === 0);
}

console.log('2. Normativa');
const oficial = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'cte_se_ae.json'), 'utf8'));
{
  comprobar('datos/cte_se_ae.json válido', SITIO.validarNormativa(oficial).length === 0, SITIO.validarNormativa(oficial).join(' | '));
  comprobar('con fuente, fecha y estado', /CTE DB SE-AE/.test(oficial.fuente) && /^\d{4}-\d{2}-\d{2}$/.test(oficial.fecha) && /PENDIENTE/.test(oficial.estado));
  comprobar('nieve oficial pendiente: no se calcula', !SITIO.nieveCompleta(oficial) && SITIO.nieve(oficial, 3, 500) === null);
  comprobar('normativa de prueba completa', SITIO.validarNormativa(prueba).length === 0 && SITIO.nieveCompleta(prueba));
  const rota = JSON.parse(JSON.stringify(prueba));
  delete rota.viento.zonas.B; rota.categorias_terreno.III.k = 0; rota.nieve.tabla.altitudes = [0, 400, 200, 600, 800, 1000, 1200];
  const e = SITIO.validarNormativa(rota);
  comprobar('normativa incompleta: errores claros', e.length === 3 && e.some(x => x.includes('zona B')) && e.some(x => x.includes('III')) && e.some(x => x.includes('creciente')), e.join(' | '));
  comprobar('sin normativa: error', SITIO.validarNormativa(null).length === 1);
}

console.log('3. Cálculo');
{
  const [villa, sierra, llanos] = csv.municipios;
  const c = SITIO.cargas(prueba, sierra, { categoria: 'II', altura: 6.3 });
  comprobar('zona C: 29 m/s = 104,4 km/h, qb 0,52', c.viento.vb === 29 && casi(c.viento.kmh, 104.4) && c.viento.qb === 0.52);
  const F = 0.17 * Math.log(6.3 / 0.01);
  comprobar('ce categoría II a 6,3 m = F·(F + 7k)', casi(c.viento.ce, F * (F + 7 * 0.17)) && casi(c.viento.qe, 0.52 * c.viento.ce), `${c.viento.ce}`);
  const baja = SITIO.exposicion(prueba, 'IV', 3), en5 = SITIO.exposicion(prueba, 'IV', 5);
  comprobar('por debajo de Z se usa Z (categoría IV, Z = 5 m)', casi(baja, en5));
  comprobar('más rugosidad, menos exposición', SITIO.exposicion(prueba, 'I', 6) > SITIO.exposicion(prueba, 'II', 6) && SITIO.exposicion(prueba, 'II', 6) > SITIO.exposicion(prueba, 'III', 6));
  comprobar('nieve zona 3 a 1100 m: entre 0,8 y 1,0 → 0,9 kN/m²', casi(c.nieve.sk, 0.9) && casi(c.nieve.kgm2, 0.9 * 1000 / 9.80665), `${c.nieve.sk}`);
  comprobar('nieve en una fila exacta (zona 4 a 600 m)', casi(SITIO.nieve(prueba, 4, 600).sk, 0.4));
  comprobar('nieve bajo la primera fila', casi(SITIO.nieve(prueba, 6, -10).sk, 0.2) && casi(SITIO.nieve(prueba, 6, 40).sk, 0.2));
  comprobar('nieve sobre la última fila: la última', casi(SITIO.nieve(prueba, 1, 3000).sk, 1.4));
  comprobar('Llanos (zona B, 650 m, zona 4): 97,2 km/h y 0,425 kN/m²', casi(SITIO.cargas(prueba, llanos).viento.kmh, 97.2) && casi(SITIO.cargas(prueba, llanos).nieve.sk, 0.425));
  comprobar('Villaprueba: zona A, 93,6 km/h', casi(SITIO.cargas(prueba, villa).viento.kmh, 93.6));
}

console.log('4. Búsqueda');
{
  const idx = SITIO.indice(csv.municipios);
  comprobar('por etiqueta «Nombre (Provincia)»', idx.buscar('Sierra de Ensayo (Provincia de Ensayo)').ine === '99002');
  comprobar('sin tildes ni mayúsculas', idx.buscar('sierra de ensayo').ine === '99002' && idx.buscar('LLANOS DE PRUEBA').ine === '99003');
  comprobar('nombre repetido en dos provincias: hay que elegir', idx.buscar('Villaprueba') === null && idx.buscar('Villaprueba (Otra Provincia)').ine === '98001');
  comprobar('sugerencias', idx.sugerencias('villa').length === 2);
  comprobar('por código INE y del Catastro', idx.porIne.get('99003').nombre === 'Llanos de Prueba' && idx.porCatastro.get('98201').nombre === 'Villaprueba');
  comprobar('refcat de rústica (20): provincia + municipio del Catastro', SITIO.municipioDeRefcat('99101A001000010000XX') === '99101' && idx.porCatastro.get(SITIO.municipioDeRefcat('99101a001000010000xx')).nombre === 'Villaprueba');
  comprobar('refcat de urbana (14) o vacía: sin municipio', SITIO.municipioDeRefcat('00000X00000000') === null && SITIO.municipioDeRefcat('') === null);
  const vuelta = SITIO.desempaquetar(SITIO.empaquetar(prueba, csv, { archivo: 'x' }));
  comprobar('empaquetar y desempaquetar', JSON.stringify(vuelta) === JSON.stringify(csv.municipios));
}

console.log('5. Apto / al límite / no apto');
{
  const m = Object.assign({}, catalogo.modelos[0], { viento_cerrado: 100, nieve: 50 });
  const r = (viento, nieve) => AVI.emplazamiento(m, { viento_kmh: viento, nieve });
  comprobar('viento 89 de 100: apto', r(89).viento === 'apto');
  comprobar('viento 91 de 100: al límite (margen 10 %)', r(91).viento === 'al_limite' && r(91).resultado === 'al_limite');
  comprobar('viento 101 de 100: no apto', r(101).resultado === 'no_apto');
  comprobar('nieve 46 de 50: al límite', r(50, 46).nieve === 'al_limite');
  comprobar('nieve 60 de 50: no apto', r(50, 60).resultado === 'no_apto');
  const sinNieve = Object.assign({}, m, { nieve: 0 });
  const e = AVI.emplazamiento(sinNieve, { viento_kmh: 50, nieve: 40 });
  comprobar('nieve sin declarar (0): «sin dato», no cuenta como apto ni no apto', e.nieve === 'sin_dato' && e.resultado === 'apto');
  comprobar('sin nieve en el sitio: apto aunque no se declare', AVI.emplazamiento(sinNieve, { viento_kmh: 50, nieve: 0 }).nieve === 'apto');
  const res = MOTOR.calcular(catalogo, { modelo: catalogo.modelos[0].id, naves: 3, tramos: 11, puertas: 1, seleccion: {}, opcionales: [], sitio: { viento_kmh: 80, nieve: 30 } });
  comprobar('motor: aviso de nieve sin dato del fabricante', res.avisos.some(a => a.codigo === 'nieve_sin_dato' && a.texto.includes('30 kg/m²')));
}

console.log('6. Propuesta');
const idx = SITIO.indice(csv.municipios);
const estado = {
  modelo: 'MT-GOT-96', naves: 5, tramos: 20, puertas: 1, seleccion: {}, opcionales: new Set(), zona: 'Almería',
  viento_kmh: 97.2, nieve_kgm2: 120, sitio: { municipio: '99003', categoria: 'III', pendiente: 2.5, viento_manual: false, nieve_manual: true },
  cliente: 'Cliente de prueba', ubicacion: 'Llanos de Prueba', codigoProyecto: 'P-1', vistaActual: 'planta', parcela: {}
};
{
  const r = MOTOR.calcular(catalogo, { modelo: 'MT-GOT-96', naves: 5, tramos: 20, puertas: 1, seleccion: {}, opcionales: [], zona: 'Almería', sitio: { viento_kmh: 97.2, nieve: 120 } });
  const m = idx.porIne.get('99003');
  const sitio = {
    municipio: m, cargas: SITIO.cargas(prueba, m, { categoria: 'III', altura: r.geometria.altura_cumbrera }), categoria: prueba.categorias_terreno.III.nombre,
    pendiente: 2.5, viento_kmh: 97.2, nieve_kgm2: 120, origen_viento: 'municipio', origen_nieve: 'manual'
  };
  const html = PROPUESTA.generar({ state: estado, catalogo, r, perfiles: [], planos: {}, sitio });
  const tabla = (html.match(/Cargas del sitio frente a las declaradas por el fabricante<\/h4>([\s\S]*?)<\/table>/) || [])[1] || '';
  comprobar('propuesta: tabla de cargas del sitio frente a las declaradas', tabla.length > 0);
  comprobar('viento: sitio, origen, declarado y resultado', /Viento<\/td><td>97,2 km\/h<br><small>CTE DB SE-AE, por municipio<\/small><\/td><td>94 km\/h<sup class="est-marca">\*<\/sup><\/td><td><strong>No apto: requiere cálculo<\/strong>/.test(tabla), tabla.slice(0, 400));
  comprobar('nieve manual y sin dato del fabricante', /Nieve<\/td><td>120 kg\/m²<br><small>introducido a mano<\/small><\/td><td>no declarado<\/td><td><strong>Sin dato del fabricante<\/strong>/.test(tabla));
  comprobar('nota: no sustituye al cálculo estructural', /no sustituye al cálculo estructural/.test(html));
  comprobar('municipio, zonas, categoría y pendiente', html.includes('Llanos de Prueba (Provincia de Ensayo)') && html.includes('B / 4') && html.includes('III. Zona rural accidentada') && html.includes('2,5 %'));
  comprobar('declarado del fabricante estimado: con asterisco', tabla.includes('94 km/h<sup class="est-marca">*</sup>'));
  const sinSitio = PROPUESTA.generar({ state: Object.assign({}, estado, { sitio: undefined, nieve_kgm2: undefined }), catalogo, r, perfiles: [], planos: {} });
  comprobar('sin datos del sitio (proyecto antiguo): la propuesta sale igual', sinSitio.includes('Cargas del sitio frente a las declaradas') && sinSitio.includes('introducido a mano'));
}

console.log('7. Proyecto');
{
  const archivo = PROYECTO.serializar(estado, catalogo, null);
  const vuelta = PROYECTO.leer(JSON.stringify(archivo), catalogo);
  comprobar('se guardan municipio, categoría, pendiente, nieve y qué es manual', !vuelta.errores.length && JSON.stringify(vuelta.estado.sitio) === JSON.stringify(estado.sitio) && vuelta.estado.nieve_kgm2 === 120 && vuelta.estado.viento_kmh === 97.2);
  const malo = JSON.parse(JSON.stringify(archivo)); malo.proyecto.nieve_kgm2 = 'mucha';
  comprobar('nieve no numérica: no se abre', PROYECTO.leer(JSON.stringify(malo), catalogo).errores.some(e => e.includes('nieve_kgm2')));
}

console.log('8. Herramienta de conversión');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitio-'));
  const salida = path.join(dir, 'municipios.js');
  const herramienta = path.join(__dirname, '..', 'herramientas', 'municipios_a_js.js');
  execFileSync('node', [herramienta, path.join(DATOS, 'municipios_prueba.csv'), path.join(DATOS, 'cte_prueba.json'), salida]);
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(salida, 'utf8'), ctx);
  comprobar('genera window.SITIO_DATOS con normativa y municipios', ctx.window.SITIO_DATOS && ctx.window.SITIO_DATOS.municipios.total === 4 && SITIO.desempaquetar(ctx.window.SITIO_DATOS).length === 4 && ctx.window.SITIO_DATOS.normativa.fuente.includes('INVENTADO'));
  const malo = path.join(dir, 'malo.csv');
  fs.writeFileSync(malo, 'codigo_ine;codigo_catastro;provincia;municipio;altitud_m;zona_eolica;zona_invierno\n1;;P;X;10;Z;9\n');
  let fallo = null;
  try { execFileSync('node', [herramienta, malo, path.join(DATOS, 'cte_prueba.json'), path.join(dir, 'no.js')], { stdio: 'pipe' }); } catch (e) { fallo = e; }
  comprobar('con errores se detiene y no escribe', fallo && fallo.status === 1 && String(fallo.stderr).includes('Fila 2') && !fs.existsSync(path.join(dir, 'no.js')));
  // El del repositorio está al día con la plantilla y la normativa
  const repo = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'datos', 'municipios.js'), 'utf8'), repo);
  comprobar('datos/municipios.js = normativa del repositorio', JSON.stringify(repo.window.SITIO_DATOS.normativa) === JSON.stringify(oficial));
  comprobar('datos/municipios.js = tabla del repositorio', repo.window.SITIO_DATOS.municipios.total === SITIO.leerCSV(fs.readFileSync(path.join(__dirname, '..', 'datos', 'municipios_cte.csv'), 'utf8')).municipios.length);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
