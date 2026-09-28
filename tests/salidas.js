// ============================================================
// Pruebas de las salidas (fase 5)
// ============================================================
// Ejecutar:  node tests/salidas.js
// 1. Guardar y abrir proyecto: ida y vuelta, catálogo distinto, archivos malos.
// (tests/salidas_navegador.js repite las tres salidas en la app real.)

const PROYECTO = require('../js/proyecto.js');
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

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
