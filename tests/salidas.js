// ============================================================
// Pruebas de las salidas (fase 5)
// ============================================================
// Ejecutar:  node tests/salidas.js
// 1. Guardar y abrir proyecto: ida y vuelta, catálogo distinto, archivos malos.
// 2. Lista de materiales en Excel: se escribe, se relee y se compara con el motor;
//    la hoja de petición de oferta no lleva ningún precio.
// (tests/salidas_navegador.js repite las tres salidas en la app real.)

const PROYECTO = require('../js/proyecto.js');
const EXCEL = require('../js/excel.js');
const MOTOR = require('../js/motor/motor.js');
const XLSX = require('../lib/xlsx.mini.min.js');
const catalogo = require('../datos/catalogo-ejemplo.json');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}
const copia = (x) => JSON.parse(JSON.stringify(x));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('1. Guardar y abrir proyecto');
{
  const estado = {
    modelo: 'MT-GOT-96', naves: 6, tramos: 22, altura_canal: 5, ancho_nave: null, separacion: null, puertas: 2,
    seleccion: { ventilacion_cenital: 'C21', ventilacion_lateral: null }, opcionales: new Set(),
    zona: 'Almería', viento_kmh: 90, parcela: { largo: '150', ancho: '80', orientacion: '30', girado: true },
    cliente: 'Finca La Prueba', ubicacion: 'Níjar (Almería)', codigoProyecto: '26JD001', vistaActual: 'seccion',
    verCalculo: true // no se guarda: es una preferencia de pantalla
  };
  const archivo = PROYECTO.serializar(estado, catalogo, null);
  const texto = JSON.stringify(archivo);
  comprobar('formato y versión', archivo.formato === PROYECTO.FORMATO && archivo.version === PROYECTO.VERSION);
  comprobar('guarda el catálogo con nombre, versión, fecha y huella', archivo.catalogo.nombre === catalogo.empresa.nombre
    && archivo.catalogo.version === catalogo.empresa.version_catalogo && archivo.catalogo.fecha === catalogo.empresa.fecha
    && /^[0-9a-f]{8}$/.test(archivo.catalogo.huella));
  comprobar('no incrusta el catálogo', !texto.includes('"componentes"') && texto.length < 3000, `${texto.length} caracteres`);
  comprobar('no guarda preferencias de pantalla', !('verCalculo' in archivo.proyecto));

  const r = PROYECTO.leer(texto, catalogo, null);
  const esperado = Object.assign(copia(Object.fromEntries(Object.keys(PROYECTO.CAMPOS).map(k => [k, estado[k]]))), { opcionales: [] });
  comprobar('ida y vuelta: mismo estado', r.errores.length === 0 && igual(r.estado, esperado), JSON.stringify(r.errores));
  comprobar('mismo catálogo: sin avisos', r.avisos.length === 0 && r.mismoCatalogo === true, JSON.stringify(r.avisos));

  // Catálogo con un precio cambiado y el mismo nombre y versión
  const otro = copia(catalogo);
  otro.perfiles[0].precio += 0.1;
  comprobar('la huella cambia con cualquier dato', PROYECTO.huella(otro) !== PROYECTO.huella(catalogo));
  const r2 = PROYECTO.leer(texto, otro, { archivo: 'Catalogo_distribuidor.xlsx' });
  comprobar('catálogo distinto: se abre con aviso', r2.errores.length === 0 && r2.mismoCatalogo === false
    && r2.avisos.some(a => a.includes('mismo nombre y versión pero contenido distinto')), JSON.stringify(r2.avisos));

  // Catálogo de otro distribuidor
  const ajeno = copia(catalogo);
  ajeno.empresa.nombre = 'Otro Distribuidor S.A.'; ajeno.empresa.version_catalogo = '2.0';
  const r3 = PROYECTO.leer(texto, ajeno, null);
  comprobar('catálogo de otro distribuidor: aviso con los dos nombres', r3.avisos.some(a => a.includes(catalogo.empresa.nombre) && a.includes('Otro Distribuidor S.A.')));

  // Modelo que no existe en el catálogo cargado
  const sinModelo = copia(catalogo);
  sinModelo.modelos = sinModelo.modelos.filter(m => m.id !== 'MT-GOT-96');
  const r4 = PROYECTO.leer(texto, sinModelo, null);
  comprobar('modelo inexistente: no se abre y lo explica', r4.estado === null && r4.errores.some(e => e.includes('MT-GOT-96')));

  // Opción que ya no existe
  const sinOpcion = copia(catalogo);
  sinOpcion.componentes = sinOpcion.componentes.filter(c => c.id !== 'C21');
  const r5 = PROYECTO.leer(texto, sinOpcion, null);
  comprobar('opción desaparecida: se descarta con aviso', r5.errores.length === 0 && !('ventilacion_cenital' in r5.estado.seleccion) && r5.avisos.some(a => a.includes('C21')));

  // Archivos que no valen
  comprobar('JSON roto', PROYECTO.leer('{ esto no', catalogo).errores.length === 1);
  comprobar('otro JSON', PROYECTO.leer('{"a":1}', catalogo).errores[0].includes('no es un proyecto'));
  comprobar('versión más nueva', PROYECTO.leer(Object.assign(copia(archivo), { version: 99 }), catalogo).errores[0].includes('más nueva'));
  const malo = copia(archivo); malo.proyecto.naves = 'tres';
  comprobar('tipo incorrecto', PROYECTO.leer(malo, catalogo).errores.some(e => e.includes('naves')));
}

console.log('2. Lista de materiales en Excel');
{
  // Con obra local, ventana mariposa y el motor con un origen distinto de «estimado» (tienda)
  const r = MOTOR.calcular(catalogo, { modelo: 'MT-GOT-96', naves: 6, tramos: 22, altura_canal: 4.5, puertas: 2, zona: 'Almería', seleccion: { ventilacion_cenital: 'C21' } });
  const modelo = catalogo.modelos.find(m => m.id === 'MT-GOT-96');
  const wb = EXCEL.libro(XLSX, { r, catalogo, modelo, proyecto: { codigo: '26JD001', cliente: 'Finca La Prueba' }, fecha: '28/09/2026' });
  const leido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { cellNF: true });
  comprobar('dos hojas: Materiales y Petición de oferta', JSON.stringify(leido.SheetNames) === '["Materiales","Petición de oferta"]', JSON.stringify(leido.SheetNames));

  const M = leido.Sheets.Materiales;
  const filas = XLSX.utils.sheet_to_json(M, { header: 1, defval: '' });
  const iCab = filas.findIndex(f => f[0] === 'Categoría');
  comprobar('columnas de la lista', iCab > 0 && JSON.stringify(filas[iCab]) === JSON.stringify(['Categoría', 'Partida', 'Referencia', 'Cantidad', 'Unidad', 'kg', 'Precio unitario', 'Importe', 'Origen', 'Cálculo']));
  const lineas = filas.slice(iCab + 1, iCab + 1 + r.lineas.length);
  const cerca = (a, b, t = 0.006) => Math.abs(a - b) <= t;
  const malas = r.lineas.filter((l, i) => {
    const f = lineas[i];
    return f[1] !== l.nombre || !cerca(f[3], l.cantidad, 1e-9) || (l.importe != null && !cerca(f[7], l.importe))
      || f[8] !== l.origen || f[9] !== l.traza.calculo;
  });
  comprobar(`una fila por partida con cantidad, importe, origen y cálculo (${r.lineas.length})`, malas.length === 0, malas.map(l => l.id).join(', '));
  const suma = lineas.reduce((t, f) => t + (typeof f[7] === 'number' ? f[7] : 0), 0);
  comprobar('los importes suman los materiales', cerca(suma, r.precio.materiales, 0.01 * r.lineas.length), `${suma} vs ${r.precio.materiales}`);
  const total = filas.find(f => f[1] === 'Total');
  comprobar('total con IVA', total && cerca(total[7], r.precio.total), JSON.stringify(total));
  comprobar('obra local desglosada', filas.some(f => String(f[1]).startsWith('Obra local') && f[8] === r.precio.obra.origen));
  comprobar('orígenes del catálogo (estimado y tienda)', lineas.some(f => f[8] === 'estimado') && lineas.some(f => f[8] === 'tienda'));
  const celdaImporte = M[XLSX.utils.encode_cell({ r: iCab + 1, c: 7 })];
  comprobar('importes con formato de euros', celdaImporte && /€/.test(celdaImporte.z || ''), celdaImporte && celdaImporte.z);
  comprobar('aviso de valores estimados en la cabecera', filas.slice(0, iCab).some(f => String(f[0]).includes('estimado')));

  const O = leido.Sheets['Petición de oferta'];
  const oferta = XLSX.utils.sheet_to_json(O, { header: 1, defval: '' });
  const iCabO = oferta.findIndex(f => f[0] === 'Partida / Item');
  const cuerpo = oferta.slice(iCabO + 1);
  comprobar('petición de oferta: una fila por partida', cuerpo.length === r.lineas.length, `${cuerpo.length}`);
  comprobar('petición de oferta: columna de precio vacía', cuerpo.every(f => f[8] === ''));
  const conFormatoEuro = Object.keys(O).filter(k => k[0] !== '!' && /€/.test(O[k].z || ''));
  comprobar('petición de oferta: ninguna celda con formato de euros', conFormatoEuro.length === 0, conFormatoEuro.join(','));
  const importes = new Set([r.precio.materiales, r.precio.base_imponible, r.precio.total, ...r.lineas.map(l => l.importe)].filter(v => v).map(v => Math.round(v * 100) / 100));
  const numeros = oferta.flat().filter(v => typeof v === 'number');
  comprobar('petición de oferta: no aparece ningún importe', !numeros.some(v => importes.has(Math.round(v * 100) / 100) && v > 100), numeros.filter(v => importes.has(v)).join(','));
  comprobar('petición de oferta: textos en español e inglés', oferta[0][0].includes('Request for quotation') && oferta[iCabO].every(t => t === '' || t.includes(' / ')));
  const pilar = cuerpo.find(f => f[1] === 'PIL-120x60');
  comprobar('petición de oferta: especificación del perfil desde el catálogo', pilar && pilar[3].includes('120×60') && pilar[3].includes('Q235'), pilar && pilar[3]);
  comprobar('petición de oferta: datos del invernadero', oferta.some(f => f[0] === 'Naves / Spans' && f[1] === 6));
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
