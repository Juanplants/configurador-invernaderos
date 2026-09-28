// ============================================================
// Exportación de las hojas A3 a PDF
// ============================================================
// PDF vectorial con jsPDF + svg2pdf.js (copiados en lib/, sin internet).
// Cada hoja es una página A3 apaisada de 420 × 297 mm y su SVG, que ya está
// en milímetros, se coloca 1:1: impresa en A3 «al 100 % / tamaño real» la
// escala del cajetín es real. El PDF pide al visor que no reescale al imprimir.
//
//   await EXPORTAR.descargar([hoja, …], nombre, { titulo, autor })
//   hoja: { svg, viewBox: '0 0 420 297' } (lo que devuelven las hojas A3)
//   EXPORTAR.nombreArchivo('26JD001', 'planos') → '26JD001_planos_2026-09-28.pdf'

(function (raiz) {
  const fechaISO = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Código de proyecto apto para nombre de archivo: sin tildes ni símbolos
  const limpiar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  const nombreArchivo = (codigo, parte, fecha = new Date()) =>
    `${limpiar(codigo) || 'proyecto'}_${parte}_${fechaISO(fecha)}.pdf`;

  async function pdf(hojas, { titulo = 'Planos', autor = '' } = {}) {
    if (!raiz.jspdf || !raiz.jspdf.jsPDF) throw new Error('Falta lib/jspdf.umd.min.js');
    const { jsPDF } = raiz.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
    if (typeof doc.svg !== 'function') throw new Error('Falta lib/svg2pdf.umd.min.js');
    // svg2pdf necesita el SVG en el documento para leer estilos: fuera de la vista
    const cont = document.createElement('div');
    cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:420mm;height:297mm;overflow:hidden';
    document.body.appendChild(cont);
    try {
      for (const [i, h] of hojas.entries()) {
        if (h.viewBox !== '0 0 420 297') throw new Error('Solo se exportan hojas A3 (viewBox 0 0 420 297)');
        if (i) doc.addPage('a3', 'landscape');
        cont.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${h.viewBox}" width="420mm" height="297mm">${h.svg}</svg>`;
        await doc.svg(cont.firstElementChild, { x: 0, y: 0, width: 420, height: 297 });
      }
    } finally {
      cont.remove();
    }
    doc.setProperties({
      title: titulo, author: autor, creator: 'Configurador de Invernaderos',
      subject: 'Planos A3. Escala real al imprimir en A3 al 100 % (tamaño real).'
    });
    doc.viewerPreferences({ PrintScaling: 'None' });
    return doc;
  }

  async function descargar(hojas, nombre, meta) {
    const doc = await pdf(hojas, meta);
    doc.save(nombre);
    return doc;
  }

  const API = { pdf, descargar, nombreArchivo, fechaISO, limpiar };
  raiz.EXPORTAR = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
