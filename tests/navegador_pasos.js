// Ayuda común a las pruebas en Chromium: ir a un paso del flujo de 6 pasos.
// Si el paso ya se visitó, se pulsa en la barra de pasos; si no, «Siguiente»
// hasta llegar (como haría el usuario).
const PASOS = require('../js/pasos.js');

async function irA(pagina, paso) {
  if (!PASOS.LISTA.includes(paso)) throw new Error(`Paso desconocido: ${paso}`);
  const boton = pagina.locator(`.paso-boton[data-ir="${paso}"]`);
  if (await boton.isEnabled()) await boton.click();
  for (let i = 0; i < PASOS.LISTA.length && await pagina.locator('.paso-boton.actual').getAttribute('data-ir') !== paso; i++) {
    await pagina.click('#btn-siguiente');
  }
  if (await pagina.locator('.paso-boton.actual').getAttribute('data-ir') !== paso) throw new Error(`No se llega al paso ${paso}`);
}

module.exports = { irA };
