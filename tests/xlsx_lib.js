// SheetJS para las pruebas: el de lib/ o, para probar otra versión antes de
// cambiarla, el archivo que diga XLSX_LIB (ver herramientas/cambiar_sheetjs.js).
const path = require('path');
const ruta = process.env.XLSX_LIB ? path.resolve(process.env.XLSX_LIB) : path.join(__dirname, '..', 'lib', 'xlsx.mini.min.js');
module.exports = require(ruta);
