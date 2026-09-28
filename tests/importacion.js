// ============================================================
// Pruebas del importador del catálogo (fase 1)
// ============================================================
// Ejecutar:  node tests/importacion.js
// 1. La plantilla correcta carga sin errores ni avisos y da exactamente el
//    mismo catálogo que herramientas/catalogo_a_json.py.
// 2. Una copia con errores provocados (tests/generar_catalogo_con_errores.py)
//    los detecta todos, con su hoja, fila y columna, y ninguno más.

const fs = require('fs');
const path = require('path');
const XLSX = require('../lib/xlsx.mini.min.js');
const IMPORTADOR = require('../js/importador.js');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}
const leer = (ruta) => IMPORTADOR.importar(XLSX, fs.readFileSync(path.join(__dirname, '..', ruta)));
const clave = (x) => `${x.hoja} | fila ${x.fila} | ${x.columna} | ${x.codigo}`;

function mismaLista(nombre, obtenidos, esperados) {
  const o = obtenidos.map(clave).sort();
  const e = esperados.map(clave).sort();
  for (const x of e) comprobar(`${nombre}: detecta ${x}`, o.includes(x));
  for (const x of o) comprobar(`${nombre}: no esperado ${x}`, e.includes(x));
}

console.log('Plantilla correcta');
{
  const r = leer('datos/Catalogo_Plantilla_v0.4.xlsx');
  comprobar('sin errores', r.errores.length === 0, JSON.stringify(r.errores));
  comprobar('sin avisos', r.avisos.length === 0, JSON.stringify(r.avisos));
  const python = require('../datos/catalogo-ejemplo.json');
  let igual = true;
  try { require('assert').deepStrictEqual(JSON.parse(JSON.stringify(r.catalogo)), python); }
  catch (e) { igual = false; }
  comprobar('mismo catálogo que catalogo_a_json.py', igual);
  comprobar('altura por defecto 4,5 m (primera de la lista)', String(r.catalogo.modelos[0].alturas_a_canal_admitidas).startsWith('4.5;'));
}

console.log('Catálogo con errores provocados');
{
  const ESPERADO = {
    errores: [
      { hoja: 'Modelos', fila: 7, columna: 'Alturas a canal admitidas', codigo: 'medidas' },   // modelo sin alturas
      { hoja: 'Componentes', fila: 7, columna: 'Ref', codigo: 'ref' },                          // ARC-99 no existe
      { hoja: 'Componentes', fila: 9, columna: 'Factor', codigo: 'variantes' },                 // 3 variantes, 2 modelos
      { hoja: 'Componentes', fila: 10, columna: 'Regla', codigo: 'regla' },                     // por_metro
      { hoja: 'Componentes', fila: 12, columna: 'Fórmula avanzada', codigo: 'formula' },        // variable inexistente
      { hoja: 'Componentes', fila: 17, columna: 'Fórmula avanzada', codigo: 'formula' }         // fórmula incompleta
    ],
    avisos: [
      { hoja: 'Perfiles', fila: 11, columna: 'Precio', codigo: 'precio' },                      // "consultar"
      { hoja: 'Componentes', fila: 9, columna: 'Precio unitario', codigo: 'precio' },           // su perfil no tiene precio
      { hoja: 'Componentes', fila: 13, columna: 'Precio unitario', codigo: 'precio' }           // precio vacío
    ]
  };
  const r = leer('tests/datos/Catalogo_con_errores.xlsx');
  mismaLista('errores', r.errores, ESPERADO.errores);
  mismaLista('avisos', r.avisos, ESPERADO.avisos);
  const variable = r.errores.find(e => e.fila === 12);
  comprobar('el mensaje nombra la variable inexistente', variable && variable.texto.includes('kg_arriostramento'));
  const ref = r.errores.find(e => e.codigo === 'ref');
  comprobar('el mensaje nombra la referencia inexistente', ref && ref.texto.includes('ARC-99'));
}

console.log('Casos sueltos');
{
  const catalogo = require('../datos/catalogo-ejemplo.json');
  const v = IMPORTADOR.validar(JSON.parse(JSON.stringify(catalogo)));
  comprobar('el catálogo de ejemplo en JSON valida sin errores', v.errores.length === 0, JSON.stringify(v.errores));

  const noExcel = IMPORTADOR.importar(XLSX, Buffer.from('esto no es un Excel'));
  comprobar('un archivo que no es la plantilla no se acepta', noExcel.errores.length > 0);

  const cat = JSON.parse(JSON.stringify(catalogo));
  cat.modelos[0].anchos_de_nave_admitidos = '9,6';
  cat.perfiles.push(Object.assign({}, cat.perfiles[0]));
  const codigos = IMPORTADOR.validar(cat).errores.map(e => e.codigo);
  comprobar('decimal con coma en medidas → error', codigos.includes('medidas'));
  comprobar('Id repetido → error', codigos.includes('duplicado'));

  comprobar('aNumero("1,4") = 1.4', IMPORTADOR.aNumero('1,4') === 1.4);
  comprobar('aNumero("consultar") no es número', Number.isNaN(IMPORTADOR.aNumero('consultar')));
  comprobar('aNumero("nan") no es número', Number.isNaN(IMPORTADOR.aNumero('nan')));
  comprobar('clave("Máx. longitud") = max_longitud', IMPORTADOR.clave('Máx. longitud') === 'max_longitud');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
