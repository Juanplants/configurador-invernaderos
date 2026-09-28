// ============================================================
// Pruebas del terreno y el optimizador (fase 6)
// ============================================================
// Ejecutar:  node tests/terreno.js
// 1. Parcela: GML (INSPIRE del Catastro) y KML de la parcela de ejemplo
//    (inventada, tests/datos/parcela_irregular.*), que deben dar el mismo
//    polígono; UTM → longitud/latitud contra pyproj; huecos, varios recintos,
//    otros sistemas y archivos que no valen (errores, nunca excepciones).
// 2. Distancia exacta de un rectángulo a los linderos.
// 3. Optimizador: pesos de los perfiles = especificación (apartado 5); cada
//    candidata cabe con su holgura exacta; en una parcela rectangular llega al
//    óptimo analítico; con un solo criterio gana el mejor en ese criterio.

const fs = require('fs');
const path = require('path');
const PAR = require('../js/terreno/parcela.js');
const OPT = require('../js/terreno/optimizador.js');
const MOTOR = require('../js/motor/motor.js');
const GEO = require('../js/motor/geometria.js');
const CROQUIS = require('../js/terreno/croquis.js');
const EMPLAZAMIENTO = require('../js/planos/emplazamiento.js');
const AVI = require('../js/motor/avisos.js');
const catalogo = require('../datos/catalogo-ejemplo.json');
const ROJO = AVI.CONFIG.ventilacion_rojo;

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}
const leerDatos = (n) => fs.readFileSync(path.join(__dirname, 'datos', n), 'utf8');
const lado = (a, i) => Math.hypot(a[(i + 1) % a.length][0] - a[i][0], a[(i + 1) % a.length][1] - a[i][1]);

// Vértices de tests/generar_parcelas.py (metros sobre el plano UTM)
const VERTICES = [[0, 0], [212, -14], [236, 96], [158, 118], [170, 176], [62, 205], [-18, 148], [-6, 64]];
const AREA_UTM = PAR.area(VERTICES);

console.log('1. Leer la parcela');
const gml = PAR.leer(leerDatos('parcela_irregular.gml'), 'parcela_irregular.gml');
const kml = PAR.leer(leerDatos('parcela_irregular.kml'), 'parcela_irregular.kml');
{
  comprobar('GML sin errores ni avisos', !gml.errores.length && !gml.avisos.length, gml.errores.concat(gml.avisos).join(' | '));
  comprobar('KML sin errores ni avisos', !kml.errores.length && !kml.avisos.length, kml.errores.concat(kml.avisos).join(' | '));
  const m = gml.meta;
  comprobar('GML: formato, sistema y referencia', m.formato === 'GML' && m.srs === 'EPSG:25830' && m.refcat === '00000X00000000', JSON.stringify(m));
  comprobar('GML: superficie declarada', m.area_declarada === Math.round(AREA_UTM), `${m.area_declarada}`);
  comprobar('KML: formato y referencia desde el nombre', kml.meta.formato === 'KML' && kml.meta.refcat === '00000X00000000');
  comprobar('8 vértices y ningún hueco', m.vertices === 8 && m.huecos === 0 && gml.anillos.length === 1);
  comprobar('exterior en sentido antihorario', PAR.areaFirmada(gml.anillos[0]) > 0 && PAR.areaFirmada(kml.anillos[0]) > 0);
  const [cx, cy] = PAR.centroide(gml.anillos[0]);
  comprobar('centrada en su centroide', Math.abs(cx) < 1e-6 && Math.abs(cy) < 1e-6, `${cx}, ${cy}`);
  // En el terreno las medidas son las del plano UTM divididas por su factor de escala
  // (≈ 0,99963 a 50 km del meridiano central): un 0,04 % mayores
  const k = PAR.area(VERTICES) / m.area;
  comprobar('superficie real ≈ la del plano UTM / k²', Math.abs(Math.sqrt(k) - 0.99963) < 0.00005, `k = ${Math.sqrt(k)}`);
  const ref = gml.anillos[0];
  const lados = VERTICES.map((_, i) => lado(VERTICES, i) / Math.sqrt(k));
  const ladosGml = ref.map((_, i) => lado(ref, i));
  comprobar('lados del GML = los del polígono (a escala real)', lados.every((l, i) => Math.abs(l - ladosGml[i]) < 0.01), JSON.stringify(ladosGml.map(l => l.toFixed(2))));
  const dif = Math.max(...kml.anillos[0].map((p, i) => Math.hypot(p[0] - ref[i][0], p[1] - ref[i][1])));
  comprobar('GML y KML dan el mismo polígono (< 1 cm)', dif < 0.01, `${dif} m`);
  comprobar('misma superficie en GML y KML', Math.abs(gml.meta.area - kml.meta.area) < 0.5);
}
{
  // UTM → geográficas contra pyproj (EPSG:258xx → 4258)
  const casos = [[30, 550000, 4075000, -2.439375806, 36.819537635], [29, 720000, 4700000, -6.325944928, 42.421130050], [31, 420000, 4600000, 2.040790629, 41.547663756]];
  for (const [huso, E, N, lon, lat] of casos) {
    const [x, y] = PAR.utmAGeo(E, N, huso);
    comprobar(`UTM ${huso} → geográficas como pyproj`, Math.abs(x - lon) < 1e-8 && Math.abs(y - lat) < 1e-8, `${x} ${y}`);
  }
}
{
  // GML sintéticos: dos recintos (uno con hueco), geográficas (lat lon), ED50, sistema raro
  const anillo = (pts) => pts.concat([pts[0]]).map(p => p.join(' ')).join(' ');
  const cuadrado = (x, y, l) => [[x, y], [x + l, y], [x + l, y + l], [x, y + l]];
  const poli = (ext, huecos = []) => `<gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>${anillo(ext)}</gml:posList></gml:LinearRing></gml:exterior>`
    + huecos.map(h => `<gml:interior><gml:LinearRing><gml:posList>${anillo(h)}</gml:posList></gml:LinearRing></gml:interior>`).join('') + '</gml:Polygon>';
  const doc = (srs, cuerpo) => `<?xml version="1.0"?><FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2"><gml:MultiSurface srsName="${srs}">${cuerpo}</gml:MultiSurface></FeatureCollection>`;
  const dos = PAR.leer(doc('EPSG:25830', poli(cuadrado(500000, 4100000, 50)) + poli(cuadrado(501000, 4100000, 200), [cuadrado(501050, 4100050, 40)])), 'dos.gml');
  comprobar('varios recintos: se usa el mayor, con aviso', dos.anillos && Math.abs(dos.meta.area - (200 * 200 - 40 * 40) / 0.9996 ** 2) < 30 && dos.avisos.some(a => a.includes('2 recintos')), `${dos.meta && dos.meta.area}`);
  comprobar('hueco leído y avisado', dos.anillos && dos.anillos.length === 2 && dos.meta.huecos === 1 && dos.avisos.some(a => a.includes('hueco')));
  comprobar('hueco en sentido horario', dos.anillos && PAR.areaFirmada(dos.anillos[1]) < 0);
  const geo = PAR.leer(doc('http://www.opengis.net/def/crs/EPSG/0/4258', poli([[37, -2], [37, -1.999], [37.001, -1.999], [37.001, -2]])), 'geo.gml');
  const ancho = 0.001 * Math.PI / 180 * 6378137 * Math.cos(37 * Math.PI / 180);
  comprobar('geográficas (latitud, longitud)', geo.anillos && Math.abs(geo.meta.area / 110.9 - ancho) < 1, `${geo.meta && geo.meta.area}`);
  const ed50 = PAR.leer(doc('EPSG:23030', poli(cuadrado(500000, 4100000, 100))), 'ed50.gml');
  comprobar('ED50: se lee con aviso', ed50.anillos && ed50.avisos.some(a => a.includes('ED50')));
  const raro = PAR.leer(doc('EPSG:3857', poli(cuadrado(0, 0, 100))), 'raro.gml');
  comprobar('sistema no admitido: error claro', !raro.anillos && raro.errores[0].includes('no admitido'));
  const declarada = PAR.leer(doc('EPSG:25830', poli(cuadrado(500000, 4100000, 100))).replace('<gml:MultiSurface', '<cp:areaValue>12000</cp:areaValue><gml:MultiSurface'), 'd.gml');
  comprobar('superficie muy distinta de la declarada: aviso', declarada.avisos.some(a => a.includes('difiere')));
}
{
  const malos = [['', 'vacio.gml'], ['hola', 'nota.txt'], ['<FeatureCollection></FeatureCollection>', 'sin.gml'], ['<kml><Placemark><name>x</name></Placemark></kml>', 'sin.kml'],
    ['<kml><Polygon><outerBoundaryIs><coordinates>1,2 3,4</coordinates></outerBoundaryIs></Polygon></kml>', 'dos_puntos.kml'], [leerDatos('parcela_irregular.gml').slice(0, 900), 'cortado.gml']];
  for (const [t, n] of malos) {
    let r, excepcion = null;
    try { r = PAR.leer(t, n); } catch (e) { excepcion = e; }
    comprobar(`archivo que no vale (${n}): error, sin excepción`, !excepcion && r.anillos === null && r.errores.length > 0, excepcion ? excepcion.message : JSON.stringify(r && r.errores));
  }
}

console.log('2. Distancia a los linderos');
{
  const [cuadro] = PAR.rectangulo(100, 100, 0);
  const d = PAR.holguraRect([cuadro], { cx: 0, cy: 0, azimut: 0, largo: 20, ancho: 10 });
  comprobar('rectángulo centrado: 40 m al lindero más cercano', Math.abs(d.distancia - 40) < 1e-9 && Math.abs(Math.abs(d.hasta[1]) - 50) < 1e-9, JSON.stringify(d));
  comprobar('los puntos más cercanos distan esa distancia', Math.abs(Math.hypot(d.hasta[0] - d.desde[0], d.hasta[1] - d.desde[1]) - d.distancia) < 1e-9);
  const girado = PAR.holguraRect([cuadro], { cx: 0, cy: 0, azimut: 45, largo: 20, ancho: 10 });
  comprobar('girado 45°: 50 − la mitad de la diagonal proyectada', Math.abs(girado.distancia - (50 - 15 / Math.SQRT2)) < 1e-9, `${girado.distancia}`);
  comprobar('fuera de la parcela: negativa', PAR.holguraRect([cuadro], { cx: 45, cy: 0, azimut: 0, largo: 20, ancho: 20 }).distancia < 0);
  const hueco = PAR.esquinas({ cx: 0, cy: 30, azimut: 0, largo: 10, ancho: 10 }).reverse();
  comprobar('pisa un hueco: negativa', PAR.holguraRect([cuadro, hueco], { cx: 0, cy: 25, azimut: 0, largo: 20, ancho: 10 }).distancia < 0);
  comprobar('rodea un hueco: negativa', PAR.holguraRect([cuadro, hueco], { cx: 0, cy: 30, azimut: 0, largo: 30, ancho: 30 }).distancia < 0);
  const junto = PAR.holguraRect([cuadro, hueco], { cx: 0, cy: 0, azimut: 0, largo: 20, ancho: 10 });
  comprobar('junto a un hueco: la distancia es al hueco', Math.abs(junto.distancia - 15) < 1e-9, `${junto.distancia}`);
}

console.log('3. Optimizador');
{
  // Pesos de los perfiles: la tabla del apartado 5 de la especificación
  const espec = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ESPECIFICACION.md'), 'utf8');
  const filas = [...espec.matchAll(/^\| ([^|]+?)(?: \(defecto\))? \| (\d+) % \| (\d+) % \| (\d+) % \| (\d+) % \|$/gm)];
  comprobar('la especificación tiene los 4 perfiles', filas.length === 4, `${filas.length}`);
  for (const f of filas) {
    const p = Object.values(OPT.PERFILES).find(x => x.nombre === f[1].trim());
    comprobar(`perfil «${f[1].trim()}» con los pesos de la especificación`, p && [p.coste, p.superficie, p.ventilacion, p.orientacion].every((v, i) => Math.abs(v * 100 - +f[i + 2]) < 1e-9), JSON.stringify(p));
  }
  for (const p of Object.values(OPT.PERFILES)) comprobar(`${p.nombre}: los pesos suman 100 %`, Math.abs(p.coste + p.superficie + p.ventilacion + p.orientacion - 1) < 1e-9);
}
const HOLGURA = 4;
const r = OPT.buscar({ anillos: gml.anillos, catalogo, holgura: HOLGURA, perfil: 'equilibrado' });
{
  comprobar('3 mejores en la parcela de ejemplo', r.mejores.length === 3, `${r.mejores.length}`);
  comprobar('muchas combinaciones evaluadas', r.candidatas >= 20, `${r.candidatas}`);
  comprobar('distintas de verdad: otro modelo u otra ventana', new Set(r.mejores.map(c => c.modelo.id + '|' + c.ventana.id)).size === 3, r.mejores.map(c => `${c.modelo.id} ${c.ventana.id} ${c.naves}`).join(', '));
  comprobar('ordenadas por puntuación', r.mejores.every((c, i) => !i || r.mejores[i - 1].puntuacion >= c.puntuacion));
  const validas = r.todas.filter(c => !c.enRojo);
  comprobar('la primera es la de mayor puntuación sin ventilación en rojo', r.mejores[0].puntuacion === Math.max(...validas.map(c => c.puntuacion)));
  // Cada una es la mejor de su modelo + ventana
  for (const c of r.mejores) {
    const grupo = r.todas.filter(x => x.modelo.id === c.modelo.id && x.ventana.id === c.ventana.id && x.enRojo === c.enRojo);
    comprobar(`${c.modelo.id} + ${c.ventana.nombre}: la mejor de su grupo`, c.puntuacion === Math.max(...grupo.map(x => x.puntuacion)));
  }
  // Ventilación: se prueba cada ventana cenital del catálogo y no se proponen opciones en rojo
  const ventanas = catalogo.componentes.filter(x => x.grupo_alternativas === OPT.GRUPO_VENTANA).map(x => x.id).sort();
  const porMedida = new Map();
  for (const c of r.todas) { const k = `${c.modelo.id}|${c.naves}|${c.tramos}|${c.ancho_nave}|${c.separacion}`; porMedida.set(k, (porMedida.get(k) || []).concat(c.ventana.id)); }
  comprobar('cada medida se calcula con todas las ventanas cenitales', [...porMedida.values()].every(v => JSON.stringify(v.slice().sort()) === JSON.stringify(ventanas)), JSON.stringify(ventanas));
  comprobar(`ninguna de las 3 por debajo del ${ROJO * 100} % de ventilación`, r.mejores.every(c => !c.enRojo && c.ventilacion >= ROJO), r.mejores.map(c => (c.ventilacion * 100).toFixed(1)).join(', '));
  comprobar('enRojo = ventilación < límite rojo', r.todas.every(c => c.enRojo === (c.ventilacion < ROJO)));
  const unaHoja = r.todas.find(c => c.modelo.id === 'MT-GOT-96' && c.naves === 15 && c.ventana.id === 'C20');
  const mariposa = r.todas.find(c => c.modelo.id === 'MT-GOT-96' && c.naves === 15 && c.tramos === (unaHoja && unaHoja.tramos) && c.ventana.id === 'C21');
  comprobar('la mariposa ventila más que la de una hoja (15 naves)', unaHoja && mariposa && mariposa.ventilacion > unaHoja.ventilacion && unaHoja.enRojo);
  // Catálogo con una sola ventana que no llega: salen al final, marcadas y con aviso
  const pobre = JSON.parse(JSON.stringify(catalogo));
  pobre.componentes = pobre.componentes.filter(x => x.id !== 'C21');
  const rp = OPT.buscar({ anillos: gml.anillos, catalogo: pobre, holgura: HOLGURA });
  const idxRojo = rp.mejores.findIndex(c => c.enRojo);
  comprobar('sin mariposa: las que quedan en rojo van al final', idxRojo === -1 || rp.mejores.slice(idxRojo).every(c => c.enRojo));
  comprobar('sin mariposa: con aviso visible', rp.mejores.filter(c => c.enRojo).every(c => c.aviso.includes('por debajo del 15 %')) && (idxRojo === -1 || rp.avisos.some(a => a.includes('ventilación'))));
  comprobar('sin mariposa: sigue habiendo 3 distintas', rp.mejores.length === 3 && new Set(rp.mejores.map(c => `${c.modelo.id}|${c.ventana.id}|${c.azimut}|${c.naves}`)).size === 3);
  let malas = 0;
  for (const c of r.todas) {
    const imp = c.implantacion;
    const d = PAR.holguraRect(gml.anillos, { cx: imp.cx, cy: imp.cy, azimut: imp.azimut, largo: c.largo, ancho: c.ancho }).distancia;
    if (d < HOLGURA - 1e-6 || Math.abs(imp.largo - c.largo) > 1e-9 || Math.abs(imp.ancho - c.ancho) > 1e-9 || c.azimut % OPT.PASO !== 0) malas++;
  }
  comprobar('todas caben dejando la holgura exacta a los linderos', malas === 0, `${malas} de ${r.todas.length}`);
  for (const c of r.mejores) {
    const m = MOTOR.calcular(catalogo, { modelo: c.modelo.id, naves: c.naves, tramos: c.tramos, ancho_nave: c.ancho_nave, separacion: c.separacion,
      altura_canal: GEO.lista(c.modelo.alturas_a_canal_admitidas)[0], puertas: 1, seleccion: { [OPT.GRUPO_VENTANA]: c.ventana.id }, opcionales: [] });
    comprobar(`${c.modelo.id} ${c.naves} × ${c.tramos}: €/m² y ventilación del motor`, Math.abs(m.precio.eur_m2 - c.eur_m2) < 1e-9 && Math.abs(m.ventilacion.pct_total - c.ventilacion) < 1e-9);
    comprobar(`${c.modelo.id} ${c.naves} × ${c.tramos}: medidas`, Math.abs(c.largo - c.tramos * c.separacion) < 1e-9 && Math.abs(c.ancho - c.naves * c.ancho_nave) < 1e-9);
    const p = OPT.PERFILES.equilibrado, dd = c.detalle;
    comprobar('puntuación = Σ peso × criterio', Math.abs(c.puntuacion - (p.coste * dd.coste + p.superficie * dd.superficie + p.ventilacion * dd.ventilacion + p.orientacion * dd.orientacion)) < 1e-12);
    comprobar('criterios entre 0 y 1', Object.values(dd).every(v => v >= -1e-12 && v <= 1 + 1e-12));
  }
  // Con un solo criterio gana la mejor en ese criterio
  const solo = (k) => OPT.buscar({ anillos: gml.anillos, catalogo, holgura: HOLGURA, pesos: Object.assign({ coste: 0, superficie: 0, ventilacion: 0, orientacion: 0 }, { [k]: 1 }) });
  const s = solo('superficie'), c = solo('coste'), v = solo('ventilacion'), o = solo('orientacion');
  const noRojo = (x) => x.todas.filter(y => !y.enRojo);
  comprobar('solo superficie: la mayor (sin rojo)', s.mejores[0].area === Math.max(...noRojo(s).map(x => x.area)));
  comprobar('solo coste: el menor €/m² (sin rojo)', c.mejores[0].eur_m2 === Math.min(...noRojo(c).map(x => x.eur_m2)));
  comprobar('solo ventilación: la mayor ventilación', v.mejores[0].ventilacion === Math.max(...v.todas.map(x => x.ventilacion)));
  comprobar('solo orientación: cumbrera norte-sur', o.mejores[0].azimut === 0 && o.mejores[0].orientacion === 1);
  // Los perfiles dan puntuaciones distintas (cambia el orden de las candidatas)
  const orden = (perfil) => OPT.buscar({ anillos: gml.anillos, catalogo, holgura: HOLGURA, perfil }).todas.slice(0, 10).map(x => `${x.modelo.id}|${x.ventana.id}|${x.naves}|${x.tramos}`).join();
  comprobar('los perfiles ordenan distinto', new Set(Object.keys(OPT.PERFILES).map(orden)).size > 1);
  comprobar('perfil en el resultado', r.perfil === 'Equilibrado');
}
{
  // Orientación preferida (dato del proyecto)
  const soloOrient = (orientacion) => OPT.buscar({ anillos: gml.anillos, catalogo, holgura: HOLGURA, orientacion, pesos: { coste: 0, superficie: 0, ventilacion: 0, orientacion: 1 } });
  const ns = soloOrient('norte_sur'), eo = soloOrient('este_oeste'), ind = soloOrient('indiferente');
  comprobar('norte-sur: cumbrera a 0°', ns.mejores[0].azimut === 0 && ns.orientacion === 'norte_sur');
  comprobar('este-oeste: cumbrera a 90°', eo.mejores[0].azimut === 90 && eo.mejores[0].orientacion === 1);
  comprobar('indiferente: la orientación no puntúa', ind.todas.every(x => x.detalle.orientacion === 1));
  comprobar('puntuación de orientación', Math.abs(OPT.puntuaOrientacion(30, 'norte_sur') - Math.cos(Math.PI / 6)) < 1e-12 && Math.abs(OPT.puntuaOrientacion(30, 'este_oeste') - 0.5) < 1e-12 && OPT.puntuaOrientacion(30, 'indiferente') === 1);
  const [cuadro] = PAR.rectangulo(100, 100, 0);
  comprobar('encajar con preferencia este-oeste', OPT.encajar([cuadro], 60, 30, 3, 'este_oeste').azimut === 90);
  const soloDos = OPT.buscar({ anillos: [cuadro], catalogo, holgura: 3, azimuts: [30, 120] });
  comprobar('azimuts: solo las orientaciones pedidas', soloDos.todas.every(x => x.azimut === 30 || x.azimut === 120) && soloDos.todas.length > 0);
}
{
  // El croquis y el plano de emplazamiento muestran el invernadero con la misma orientación
  for (const orientacion of ['norte_sur', 'indiferente']) {
    const res = OPT.buscar({ anillos: gml.anillos, catalogo, holgura: HOLGURA, orientacion });
    for (const c of res.mejores) {
      const g = GEO.calcular(c.modelo, { naves: c.naves, tramos: c.tramos, ancho_nave: c.ancho_nave, separacion: c.separacion });
      const h = EMPLAZAMIENTO.emplazamiento({ g, modelo: c.modelo, empresa: catalogo.empresa, terreno: { anillos: gml.anillos, meta: gml.meta, implantacion: c.implantacion, retranqueo: 3, camino: 4 } });
      const enCroquis = CROQUIS.anguloInvernadero(CROQUIS.svg(gml.anillos, c));
      const enPlano = CROQUIS.anguloInvernadero(h.svg);
      const dif = ((enPlano - h.giroHoja - enCroquis) % 180 + 180) % 180;
      comprobar(`${orientacion}, ${c.modelo.id} a ${c.azimut}°: misma orientación en croquis y plano`, Math.min(dif, 180 - dif) < 0.01 && Math.abs(enCroquis - c.azimut % 180) < 0.01, `croquis ${enCroquis}°, plano ${enPlano}° (hoja girada ${h.giroHoja}°)`);
      comprobar(`${orientacion}, ${c.modelo.id}: norte del plano = giro de la hoja`, h.encaje.norte === h.giroHoja && h.svg.includes(`rotate(${h.giroHoja})`));
    }
  }
}
{
  // Parcela rectangular 100 × 60 m, 7 m a los linderos (86 × 46 libres): la mayor
  // superficie posible se calcula a mano con las medidas del catálogo
  const [rect] = PAR.rectangulo(100, 60, 0);
  const libreL = 86, libreA = 46;
  let mejor = 0;
  for (const m of catalogo.modelos) {
    for (const w of GEO.lista(m.anchos_de_nave_admitidos)) for (const s of GEO.lista(m.separaciones_entre_porticos)) {
      for (const [L, A] of [[libreL, libreA], [libreA, libreL]]) {
        const n = Math.min(Math.floor(A / w + 1e-9), m.max_naves || 50), t = Math.min(Math.floor(L / s + 1e-9), Math.floor((m.max_longitud || Infinity) / s + 1e-9));
        if (n >= 1 && t >= 2) mejor = Math.max(mejor, n * w * t * s);
      }
    }
  }
  const a = OPT.buscar({ anillos: [rect], catalogo, holgura: 7, perfil: 'aprovechar' });
  const maxima = Math.max(...a.todas.map(x => x.area));
  comprobar('parcela rectangular: llega a la superficie óptima', Math.abs(maxima - mejor) < 1e-9, `${maxima} vs ${mejor}`);
  const sup = OPT.buscar({ anillos: [rect], catalogo, holgura: 7, pesos: { coste: 0, superficie: 1, ventilacion: 0, orientacion: 0 } }).mejores[0];
  const [enL, enA] = sup.azimut === 0 ? [sup.largo, sup.ancho] : [sup.ancho, sup.largo];
  comprobar('y dentro del rectángulo libre', (sup.azimut === 0 || sup.azimut === 90) && enL <= libreL + 1e-9 && enA <= libreA + 1e-9 && sup.area === mejor, `${sup.azimut}° ${sup.largo} × ${sup.ancho}`);
  const nada = OPT.buscar({ anillos: [rect], catalogo, holgura: 40 });
  comprobar('sin sitio: ninguna, con aviso', nada.mejores.length === 0 && nada.avisos.some(t => t.includes('No cabe')));
  // Modelo no apto para el viento del sitio: se descarta
  const cat = JSON.parse(JSON.stringify(catalogo));
  cat.modelos[0].viento_cerrado = 80;
  const debil = cat.modelos[0].id;
  const sinDebil = OPT.buscar({ anillos: [rect], catalogo: cat, holgura: 7, base: { sitio: { viento_kmh: 90 } } });
  comprobar('modelo no apto para el viento: descartado y avisado', sinDebil.todas.length > 0 && sinDebil.todas.every(c => c.modelo.id !== debil) && sinDebil.avisos.some(t => t.includes('no apto')), JSON.stringify(sinDebil.avisos));
}
{
  // Encajar unas medidas fijas (al elegir el modelo a mano)
  const [rect] = PAR.rectangulo(100, 60, 0);
  const e = OPT.encajar([rect], 80, 40, 5);
  comprobar('encajar: cabe, norte-sur, con la holgura', e && e.azimut === 0 && PAR.holguraRect([rect], Object.assign({}, e, { largo: 80, ancho: 40 })).distancia >= 5 - 1e-9, JSON.stringify(e));
  comprobar('encajar: no cabe → null', OPT.encajar([rect], 95, 40, 5) === null);
  const [girada] = PAR.rectangulo(100, 30, 60);
  const g = OPT.encajar([girada], 90, 20, 2);
  comprobar('encajar en parcela girada: sigue su lado largo', g && g.azimut === 60, JSON.stringify(g));
  const hueco = PAR.esquinas({ cx: 0, cy: 0, azimut: 0, largo: 10, ancho: 10 }).reverse();
  const h = OPT.encajar([rect, hueco], 30, 20, 3);
  comprobar('encajar con hueco: no lo pisa', h && PAR.holguraRect([rect, hueco], Object.assign({}, h, { largo: 30, ancho: 20 })).distancia >= 3 - 1e-9, JSON.stringify(h));
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
