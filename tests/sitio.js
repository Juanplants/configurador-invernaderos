// ============================================================
// Pruebas de las cargas del sitio (CTE DB SE-AE)
// ============================================================
// Ejecutar:  node tests/sitio.js
// Con la normativa del repositorio (datos/cte_se_ae.json: anejo D, tablas E.2 y
// 3.8) y, para la tabla de municipios opcional, municipios INVENTADOS
// (tests/datos/municipios_prueba.csv).
// 1. Tabla de municipios (opcional): lectura y validación con filas y motivos.
// 2. Normativa: valores del documento oficial, huecos de la tabla E.2, capitales
//    coherentes con la tabla E.2, y errores si falta algo.
// 3. Cálculo: vb → km/h, ce de la categoría de terreno, nieve interpolada,
//    «fuera de tabla» por encima de la última altitud con dato, capitales.
// 4. Búsqueda por nombre, por código INE y por la referencia catastral de rústica.
// 5. Apto / al límite / no apto (margen 10 %), nieve sin dato y fuera de tabla.
// 6. Propuesta: tabla de cargas del sitio frente a las declaradas, con la nota.
// 7. Proyecto: zonas, altitud, capital, categoría, pendiente y manuales se guardan.
// 8. herramientas/municipios_a_js.js genera datos/municipios.js y rechaza errores.
// 9. Catálogo: columna «Base del viento declarado» en la hoja Modelos.

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
const oficial = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'cte_se_ae.json'), 'utf8'));
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
{
  comprobar('datos/cte_se_ae.json válido', SITIO.validarNormativa(oficial).length === 0, SITIO.validarNormativa(oficial).join(' | '));
  comprobar('con fuente, fecha y estado (ya sin «pendiente de contrastar»)', /CTE DB SE-AE/.test(oficial.fuente) && /^\d{4}-\d{2}-\d{2}$/.test(oficial.fecha) && !/pendiente/i.test(oficial.estado));
  const z = oficial.viento.zonas, k = oficial.categorias_terreno;
  comprobar('viento: vb 26/27/29 m/s y qb 0,42/0,45/0,52 kN/m²', z.A.vb === 26 && z.B.vb === 27 && z.C.vb === 29 && z.A.qb === 0.42 && z.B.qb === 0.45 && z.C.qb === 0.52);
  comprobar('tabla D.2: k, L, Z de I a V', JSON.stringify(['I', 'II', 'III', 'IV', 'V'].map(c => [k[c].k, k[c].L, k[c].Z])) === JSON.stringify([[0.156, 0.003, 1], [0.17, 0.01, 1], [0.19, 0.05, 2], [0.22, 0.3, 5], [0.24, 1, 10]]));
  const t = oficial.nieve.tabla;
  comprobar('tabla E.2: 14 altitudes de 0 a 2200 m', t.altitudes.length === 14 && t.altitudes[0] === 0 && t.altitudes[12] === 1800 && t.altitudes[13] === 2200);
  const fila = (a) => [1, 2, 3, 4, 5, 6, 7].map(z => t.zonas[z][t.altitudes.indexOf(a)]);
  comprobar('fila 0 m', JSON.stringify(fila(0)) === '[0.3,0.4,0.2,0.2,0.2,0.2,0.2]');
  comprobar('fila 1000 m', JSON.stringify(fila(1000)) === '[1.7,1.5,0.7,1.2,0.9,1.2,0.2]');
  comprobar('fila 1600 m', JSON.stringify(fila(1600)) === '[4.3,3.5,2.6,4.6,2.5,5.5,0.2]');
  comprobar('fila 1800 m, con huecos', JSON.stringify(fila(1800)) === '[null,4.6,4,null,null,9.3,0.2]');
  comprobar('fila 2200 m: solo la zona 2', JSON.stringify(fila(2200)) === '[null,8,null,null,null,null,null]');
  const caps = oficial.capitales.lista;
  comprobar('tabla 3.8: 51 filas (Ceuta y Melilla juntas: 52 ciudades)', caps.length === 51 && caps.some(c => c.nombre === 'Ceuta y Melilla'));
  const cap = (n) => caps.find(c => c.nombre === n);
  comprobar('capitales: Ávila, León, Madrid, Almería, Soria', JSON.stringify(['Ávila', 'León', 'Madrid', 'Almería', 'Soria'].map(n => [cap(n).altitud, cap(n).sk])) === '[[1130,1],[820,1.2],[660,0.6],[0,0.2],[1090,0.9]]');
  // Coherencia entre tablas: la nieve de cada capital es la de alguna zona de la E.2 a su altitud
  const lejos = caps.filter(c => ![1, 2, 3, 4, 5, 6, 7].some(zz => { const r = SITIO.nieve(oficial, zz, c.altitud); return r && !r.fuera && Math.abs(r.sk - c.sk) <= 0.1 + 1e-9; }));
  comprobar('cada capital coincide con la tabla E.2 de alguna zona (±0,1 kN/m²)', lejos.length === 0, lejos.map(c => c.nombre).join(', '));
  const rota = JSON.parse(JSON.stringify(oficial));
  delete rota.viento.zonas.B; rota.categorias_terreno.III.k = 0; rota.nieve.tabla.altitudes[2] = 100;
  rota.nieve.tabla.zonas['5'] = rota.nieve.tabla.zonas['5'].slice(1); rota.nieve.tabla.zonas['7'] = rota.nieve.tabla.zonas['7'].map(() => null);
  rota.capitales.lista[0].sk = undefined;
  const e = SITIO.validarNormativa(rota);
  comprobar('normativa rota: errores claros', e.length === 6 && ['zona B', 'III', 'creciente', 'zona 5', 'zona 7', 'Albacete'].every(x => e.some(y => y.includes(x))), e.join(' | '));
  comprobar('sin normativa: error', SITIO.validarNormativa(null).length === 1);
}

console.log('3. Cálculo');
{
  const c = SITIO.cargas(oficial, { zona_eolica: 'C', zona_invierno: 3, altitud: 1100 }, { categoria: 'II', altura: 6.3 });
  comprobar('zona C: 29 m/s = 104,4 km/h, qb 0,52', c.viento.vb === 29 && casi(c.viento.kmh, 104.4) && c.viento.qb === 0.52);
  const F = 0.17 * Math.log(6.3 / 0.01);
  comprobar('ce categoría II a 6,3 m = F·(F + 7k)', casi(c.viento.ce, F * (F + 7 * 0.17)) && casi(c.viento.qe, 0.52 * c.viento.ce), `${c.viento.ce}`);
  comprobar('por debajo de Z se usa Z (categoría IV, Z = 5 m)', casi(SITIO.exposicion(oficial, 'IV', 3), SITIO.exposicion(oficial, 'IV', 5)));
  comprobar('más rugosidad, menos exposición', SITIO.exposicion(oficial, 'I', 6) > SITIO.exposicion(oficial, 'II', 6) && SITIO.exposicion(oficial, 'II', 6) > SITIO.exposicion(oficial, 'III', 6));
  comprobar('nieve zona 3 a 1100 m: entre 0,7 y 1,1 → 0,9 kN/m²', casi(c.nieve.sk, 0.9) && casi(c.nieve.kgm2, 0.9 * 1000 / 9.80665) && c.nieve.origen === 'tabla', `${c.nieve.sk}`);
  const nv = (z, a) => SITIO.nieve(oficial, z, a);
  comprobar('fila exacta (zona 4 a 600 m): 0,5', casi(nv(4, 600).sk, 0.5));
  comprobar('zona 4 a 650 m: 0,55', casi(nv(4, 650).sk, 0.55));
  comprobar('zona 2 a 2000 m: entre 4,6 (1800) y 8,0 (2200) → 6,3', casi(nv(2, 2000).sk, 6.3));
  comprobar('última altitud con dato: vale (zona 2 a 2200, zona 3 a 1800)', casi(nv(2, 2200).sk, 8) && !nv(2, 2200).fuera && casi(nv(3, 1800).sk, 4));
  comprobar('zona 1 a 1700 m: fuera de tabla (llega a 1600)', nv(1, 1700).fuera && nv(1, 1700).ultima === 1600 && nv(1, 1700).sk === null);
  comprobar('zona 3 a 1801 m y zona 2 a 2201 m: fuera de tabla', nv(3, 1801).fuera && nv(2, 2201).fuera);
  comprobar('zona 7: 0,2 hasta 1800 m, luego fuera', casi(nv(7, 1800).sk, 0.2) && nv(7, 1900).fuera);
  comprobar('bajo cero: la primera fila', casi(nv(1, -5).sk, 0.3));
  const alm = SITIO.capital(oficial, 'almeria');
  comprobar('capital por nombre sin tilde: Almería, 0 m, 0,2 kN/m²', alm.nombre === 'Almería' && alm.altitud === 0 && casi(alm.kgm2, 0.2 * 1000 / 9.80665));
  const conCapital = SITIO.cargas(oficial, { zona_eolica: 'A', zona_invierno: 1, altitud: 1500, capital: 'Ávila' });
  comprobar('con capital manda la tabla 3.8 (Ávila 1,0), no zona y altitud', conCapital.nieve.origen === 'capital' && casi(conCapital.nieve.sk, 1));
  comprobar('sin zona eólica: sin viento', SITIO.cargas(oficial, { zona_invierno: 1, altitud: 0 }).viento === null);
  comprobar('sin altitud o sin zona invernal: sin nieve', SITIO.cargas(oficial, { zona_eolica: 'A', zona_invierno: 1, altitud: '' }).nieve === null && SITIO.cargas(oficial, { zona_eolica: 'A', zona_invierno: '', altitud: 100 }).nieve === null);
  // Un municipio de la tabla (opcional) aporta zonas y altitud
  const [villa, sierra, llanos] = csv.municipios;
  comprobar('municipio de la tabla: Llanos (B, zona 4, 650 m) → 97,2 km/h y 0,55', casi(SITIO.cargas(oficial, llanos).viento.kmh, 97.2) && casi(SITIO.cargas(oficial, llanos).nieve.sk, 0.55));
  comprobar('Villaprueba: zona A, 93,6 km/h', casi(SITIO.cargas(oficial, villa).viento.kmh, 93.6) && casi(SITIO.cargas(oficial, sierra).viento.kmh, 104.4));
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
  const vuelta = SITIO.desempaquetar(SITIO.empaquetar(oficial, csv, { archivo: 'x' }));
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
  const fuera = AVI.emplazamiento(m, { viento_kmh: 50, nieve_fuera: { zona: 1, altitud: 1700, ultima: 1600 } });
  comprobar('nieve fuera de tabla: «fuera_tabla», no cuenta', fuera.nieve === 'fuera_tabla' && fuera.resultado === 'apto');
  comprobar('fuera de tabla sin viento: también se comprueba', AVI.emplazamiento(m, { nieve_fuera: { zona: 1, altitud: 1700, ultima: 1600 } }).nieve === 'fuera_tabla');
  const rf = MOTOR.calcular(catalogo, { modelo: catalogo.modelos[0].id, naves: 3, tramos: 11, puertas: 1, seleccion: {}, opcionales: [], sitio: { viento_kmh: 80, nieve_fuera: { zona: 1, altitud: 1700, ultima: 1600 } } });
  comprobar('motor: aviso de nieve fuera de tabla, requiere estudio', rf.avisos.some(a => a.codigo === 'nieve_fuera_tabla' && a.texto.includes('requiere estudio') && a.texto.includes('1600 m')));
  const res = MOTOR.calcular(catalogo, { modelo: catalogo.modelos[0].id, naves: 3, tramos: 11, puertas: 1, seleccion: {}, opcionales: [], sitio: { viento_kmh: 80, nieve: 30 } });
  comprobar('motor: aviso de nieve sin dato del fabricante', res.avisos.some(a => a.codigo === 'nieve_sin_dato' && a.texto.includes('30 kg/m²')));
}

console.log('6. Propuesta');
const estado = {
  modelo: 'MT-GOT-96', naves: 5, tramos: 20, puertas: 1, seleccion: {}, opcionales: new Set(), zona: 'Almería',
  viento_kmh: 97.2, nieve_kgm2: 120,
  sitio: { zona_eolica: 'B', zona_invierno: 4, altitud: 650, capital: '', municipio: null, categoria: 'III', pendiente: 2.5, viento_manual: false, nieve_manual: true },
  cliente: 'Cliente de prueba', ubicacion: 'Finca de prueba', codigoProyecto: 'P-1', vistaActual: 'planta', parcela: {}
};
const calcular = (sitio) => MOTOR.calcular(catalogo, { modelo: 'MT-GOT-96', naves: 5, tramos: 20, puertas: 1, seleccion: {}, opcionales: [], zona: 'Almería', sitio });
const tablaCargas = (html) => (html.match(/Cargas del sitio frente a las declaradas por el fabricante<\/h4>([\s\S]*?)<\/table>/) || [])[1] || '';
{
  const r = calcular({ viento_kmh: 97.2, nieve: 120 });
  const sitio = {
    zona_eolica: 'B', zona_invierno: 4, altitud: 650, capital: '', municipio: null,
    cargas: SITIO.cargas(oficial, estado.sitio, { categoria: 'III', altura: r.geometria.altura_cumbrera }), fuera: null, categoria: oficial.categorias_terreno.III.nombre,
    pendiente: 2.5, viento_kmh: 97.2, nieve_kgm2: 120, origen_viento: 'zona', origen_nieve: 'manual'
  };
  const html = PROPUESTA.generar({ state: estado, catalogo, r, perfiles: [], planos: {}, sitio });
  const tabla = tablaCargas(html);
  comprobar('propuesta: tabla de cargas del sitio frente a las declaradas', tabla.length > 0);
  comprobar('viento: sitio, origen (zona eólica B), declarado con asterisco y resultado', /Viento<\/td><td>97,2 km\/h<br><small>CTE DB SE-AE, zona eólica B<\/small><\/td><td>94 km\/h<sup class="est-marca">\*<\/sup><\/td><td><strong>No apto: requiere cálculo<\/strong>/.test(tabla), tabla.slice(0, 400));
  comprobar('nieve manual y sin dato del fabricante', /Nieve<\/td><td>120 kg\/m²<br><small>introducido a mano<\/small><\/td><td>no declarado<\/td><td><strong>Sin dato del fabricante<\/strong>/.test(tabla));
  comprobar('nota: no sustituye al cálculo estructural', /no sustituye al cálculo estructural/.test(html));
  comprobar('zonas, altitud, categoría y pendiente', html.includes('Zona eólica (fig. D.1)</td><td>B') && html.includes('Zona de clima invernal (fig. E.2)</td><td>4') && html.includes('650 m') && html.includes('III. Zona rural accidentada') && html.includes('2,5 %'));
  // Capital: la nieve sale de la tabla 3.8
  const conCapital = PROPUESTA.generar({ state: estado, catalogo, r: calcular({ viento_kmh: 93.6, nieve: 61 }), perfiles: [], planos: {},
    sitio: Object.assign({}, sitio, { zona_eolica: 'A', capital: 'León', altitud: 820, viento_kmh: 93.6, nieve_kgm2: 61, origen_nieve: 'capital' }) });
  comprobar('capital: «tabla 3.8 (León)»', tablaCargas(conCapital).includes('CTE DB SE-AE, tabla 3.8 (León)') && conCapital.includes('Capital de provincia: León (tabla 3.8)'));
  // Fuera de tabla: requiere estudio
  const fuera = { zona: 1, altitud: 1700, ultima: 1600 };
  const html2 = PROPUESTA.generar({ state: estado, catalogo, r: calcular({ viento_kmh: 93.6, nieve_fuera: fuera }), perfiles: [], planos: {},
    sitio: Object.assign({}, sitio, { zona_eolica: 'A', zona_invierno: 1, altitud: 1700, nieve_kgm2: '', origen_nieve: '', fuera }) });
  comprobar('nieve fuera de tabla: «Requiere estudio» con zona y altitudes', /Nieve<\/td><td>Fuera de tabla<br><small>CTE DB SE-AE, tabla E.2: zona 1 a 1700 m \(la tabla llega a 1600 m\)<\/small><\/td><td>no declarado<\/td><td><strong>Requiere estudio<\/strong>/.test(tablaCargas(html2)), tablaCargas(html2));
  // Viento manual sin zona eólica: la propuesta sale igual (sin ce)
  let manual = '', fallo = null;
  try {
    manual = PROPUESTA.generar({ state: estado, catalogo, r: calcular({ viento_kmh: 90 }), perfiles: [], planos: {},
      sitio: Object.assign({}, sitio, { zona_eolica: '', zona_invierno: '', altitud: '', cargas: { viento: null, nieve: null }, viento_kmh: 90, nieve_kgm2: '', origen_viento: 'manual', origen_nieve: '' }) });
  } catch (e) { fallo = e; }
  comprobar('viento manual sin zona eólica: sin errores', !fallo && /90 km\/h<br><small>introducido a mano/.test(tablaCargas(manual)), fallo && fallo.message);
  const sinSitio = PROPUESTA.generar({ state: Object.assign({}, estado, { sitio: undefined, nieve_kgm2: undefined }), catalogo, r, perfiles: [], planos: {} });
  comprobar('sin datos del sitio (proyecto antiguo): la propuesta sale igual', sinSitio.includes('Cargas del sitio frente a las declaradas') && sinSitio.includes('introducido a mano'));
}

console.log('7. Proyecto');
{
  const archivo = PROYECTO.serializar(estado, catalogo, null);
  const vuelta = PROYECTO.leer(JSON.stringify(archivo), catalogo);
  comprobar('se guardan zonas, altitud, capital, categoría, pendiente, nieve y qué es manual', !vuelta.errores.length && JSON.stringify(vuelta.estado.sitio) === JSON.stringify(estado.sitio) && vuelta.estado.nieve_kgm2 === 120 && vuelta.estado.viento_kmh === 97.2);
  const malo = JSON.parse(JSON.stringify(archivo)); malo.proyecto.nieve_kgm2 = 'mucha';
  comprobar('nieve no numérica: no se abre', PROYECTO.leer(JSON.stringify(malo), catalogo).errores.some(e => e.includes('nieve_kgm2')));
}

console.log('8. Herramienta de conversión');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitio-'));
  const salida = path.join(dir, 'municipios.js');
  const herramienta = path.join(__dirname, '..', 'herramientas', 'municipios_a_js.js');
  const normativa = path.join(__dirname, '..', 'datos', 'cte_se_ae.json');
  execFileSync('node', [herramienta, path.join(DATOS, 'municipios_prueba.csv'), normativa, salida]);
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(salida, 'utf8'), ctx);
  comprobar('genera window.SITIO_DATOS con normativa y municipios', ctx.window.SITIO_DATOS && ctx.window.SITIO_DATOS.municipios.total === 4 && SITIO.desempaquetar(ctx.window.SITIO_DATOS).length === 4 && ctx.window.SITIO_DATOS.normativa.capitales.lista.length === 51);
  const malo = path.join(dir, 'malo.csv');
  fs.writeFileSync(malo, 'codigo_ine;codigo_catastro;provincia;municipio;altitud_m;zona_eolica;zona_invierno\n1;;P;X;10;Z;9\n');
  let fallo = null;
  try { execFileSync('node', [herramienta, malo, normativa, path.join(dir, 'no.js')], { stdio: 'pipe' }); } catch (e) { fallo = e; }
  comprobar('con errores se detiene y no escribe', fallo && fallo.status === 1 && String(fallo.stderr).includes('Fila 2') && !fs.existsSync(path.join(dir, 'no.js')));
  // El del repositorio está al día con la plantilla y la normativa
  const repo = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'datos', 'municipios.js'), 'utf8'), repo);
  comprobar('datos/municipios.js = normativa del repositorio', JSON.stringify(repo.window.SITIO_DATOS.normativa) === JSON.stringify(oficial));
  comprobar('datos/municipios.js = tabla del repositorio (vacía)', repo.window.SITIO_DATOS.municipios.total === 0 && SITIO.leerCSV(fs.readFileSync(path.join(__dirname, '..', 'datos', 'municipios_cte.csv'), 'utf8')).municipios.length === 0);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('9. Catálogo: base del viento declarado');
{
  const XLSX = require('./xlsx_lib.js');
  const IMPORTADOR = require('../js/importador.js');
  const libro = XLSX.read(fs.readFileSync(path.join(__dirname, '..', 'datos', 'Catalogo_Plantilla_v0.4.xlsx')));
  const cab = XLSX.utils.sheet_to_json(libro.Sheets.Modelos, { header: 1 })[3];
  comprobar('columna «Base del viento declarado» en la hoja Modelos', cab.includes('Base del viento declarado'), JSON.stringify(cab));
  const imp = IMPORTADOR.importar(XLSX, fs.readFileSync(path.join(__dirname, '..', 'datos', 'Catalogo_Plantilla_v0.4.xlsx')));
  comprobar('la plantilla se importa sin errores (columna vacía)', imp.errores.length === 0, JSON.stringify(imp.errores.slice(0, 2)));
  const c = JSON.parse(JSON.stringify(catalogo));
  c.modelos[0].base_del_viento_declarado = 'Ráfaga'; c.modelos[1].base_del_viento_declarado = 'presión kN/m²';
  comprobar('valores válidos: velocidad media, ráfaga, presión kN/m²', IMPORTADOR.validar(c).errores.length === 0);
  c.modelos[1].base_del_viento_declarado = 'media';
  const e = IMPORTADOR.validar(c).errores;
  comprobar('valor no válido: error con el modelo', e.length === 1 && e[0].texto.includes('MT-GOT-96') && e[0].texto.includes('base del viento'), JSON.stringify(e));
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
