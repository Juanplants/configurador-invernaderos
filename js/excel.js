// ============================================================
// Lista de materiales en Excel (SheetJS, lib/)
// ============================================================
//   const libro = EXCEL.libro(XLSX, { r, catalogo, modelo, proyecto, fecha })
//   EXCEL.descargar(XLSX, datos, nombre)
// Hoja «Materiales»: partida, cantidad, unidad, kg, precio unitario, importe,
// origen (el del catálogo: fabricante / literatura / tienda / estimado) y la
// traza del cálculo en columna aparte; al final obra local, IVA y total.
// Hoja «Petición de oferta»: la misma lista sin ningún precio, con encabezados
// en español e inglés, para pedir presupuesto a un fabricante.

(function (raiz) {
  const EUR = '#,##0.00 "€"';
  const NUM = '#,##0.00';
  const ENTERO = '#,##0';
  const PORC = '0%';

  const esPorcentaje = (l) => l.traza && l.traza.regla === 'porcentaje';

  function buscarRef(catalogo, id) {
    for (const hoja of ['perfiles', 'cubiertas', 'equipos']) {
      const f = (catalogo[hoja] || []).find(x => x.id === id);
      if (f) return { hoja, fila: f };
    }
    return null;
  }

  // Especificación técnica de la referencia, para el fabricante
  function especificacion(catalogo, l) {
    const ref = buscarRef(catalogo, l.ref);
    if (!ref) return esPorcentaje(l) ? 'Según estructura / as required' : '';
    const f = ref.fila;
    if (ref.hoja === 'perfiles') {
      return [`${f.medidas || ''}${f.espesor ? ` × ${f.espesor} mm` : ''}`, f.grado_acero, f.galvanizado ? `galv. ${f.galvanizado} µm` : '', f.peso ? `${f.peso} kg/m` : '']
        .filter(Boolean).join(', ');
    }
    if (ref.hoja === 'cubiertas') return [f.nombre, f.espesor].filter(Boolean).join(', ');
    return [f.nombre, f.capacidad ? `${f.capacidad} m por motor` : '', f.ancho_puerta && f.alto_puerta ? `${f.ancho_puerta} × ${f.alto_puerta} m` : '']
      .filter(Boolean).join(', ');
  }

  // Hoja a partir de filas; celdas { v, z } para dar formato numérico
  function hoja(XLSX, filas, anchos) {
    const aoa = filas.map(f => f.map(c => (c && typeof c === 'object' && 'v' in c ? c.v : c)));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    filas.forEach((f, i) => f.forEach((c, j) => {
      if (c && typeof c === 'object' && c.z && typeof c.v === 'number') ws[XLSX.utils.encode_cell({ r: i, c: j })].z = c.z;
    }));
    ws['!cols'] = anchos.map(wch => ({ wch }));
    return ws;
  }

  function libro(XLSX, { r, catalogo, modelo = {}, proyecto = {}, fecha = '' }) {
    const g = r.geometria, p = r.precio, emp = catalogo.empresa || {};
    const catalogoTxt = `${emp.nombre || '—'}${emp.version_catalogo ? ` · versión ${emp.version_catalogo}` : ''}${emp.fecha ? ` (${emp.fecha})` : ''}`;
    const dims = `${g.naves} × ${g.ancho_nave} m × ${g.largo} m · ${Math.round(g.area)} m²`;

    // ---------- Materiales ----------
    const cab = ['Categoría', 'Partida', 'Referencia', 'Cantidad', 'Unidad', 'kg', 'Precio unitario', 'Importe', 'Origen', 'Cálculo'];
    const filas = [
      [`Lista de materiales · ${emp.nombre || ''}`],
      ['Proyecto', proyecto.codigo || '', 'Cliente', proyecto.cliente || ''],
      ['Modelo', modelo.nombre || '', 'Dimensiones', dims],
      ['Catálogo', catalogoTxt, 'Fecha', fecha],
      ['Origen «estimado»: valor estimado, no es un dato del fabricante.'],
      [],
      cab
    ];
    const primeraLinea = filas.length;
    for (const l of r.lineas) {
      const pct = esPorcentaje(l);
      filas.push([
        l.categoria, l.nombre, l.ref || '',
        { v: l.cantidad, z: pct ? PORC : (l.unidad === 'ud' ? ENTERO : NUM) },
        pct ? '%' : l.unidad,
        l.kg ? { v: Math.round(l.kg * 100) / 100, z: ENTERO } : '',
        pct ? '' : (l.precio_unitario == null ? 'sin precio' : { v: l.precio_unitario, z: EUR }),
        l.importe == null ? '' : { v: Math.round(l.importe * 100) / 100, z: EUR },
        l.origen || 'sin indicar',
        (l.traza && l.traza.calculo) || ''
      ]);
    }
    const tot = (texto, v, extra = {}) => ['', texto, '', '', '', '', '', { v: Math.round(v * 100) / 100, z: EUR }, extra.origen || '', extra.calculo || ''];
    filas.push([]);
    filas.push(tot('Materiales', p.materiales));
    if (p.obra) {
      filas.push(tot(`Obra local · ${p.obra.zona}: movilización`, p.obra.movilizacion, { origen: p.obra.origen, calculo: 'por obra' }));
      filas.push(tot('Obra local: montaje', p.obra.montaje, { origen: p.obra.origen, calculo: `${Math.round(g.area)} m²` }));
      filas.push(tot('Obra local: hoyos y dados', p.obra.hoyos, { origen: p.obra.origen, calculo: `${g.pilares + g.pilares_hastial} pilares` }));
    }
    filas.push(tot('Base imponible', p.base_imponible));
    filas.push(tot(`IVA ${Math.round(p.iva_pct * 100)} %`, p.iva));
    filas.push(tot('Total', p.total));
    const materiales = hoja(XLSX, filas, [14, 34, 14, 12, 8, 10, 14, 14, 12, 60]);
    materiales['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: primeraLinea - 1, c: 0 }, e: { r: primeraLinea - 1 + r.lineas.length, c: cab.length - 1 } }) };

    // ---------- Petición de oferta (sin precios) ----------
    const rfq = [
      ['Petición de oferta / Request for quotation'],
      ['Proyecto / Project', proyecto.codigo || '', 'Fecha / Date', fecha],
      ['Modelo / Model', modelo.nombre || ''],
      ['Naves / Spans', g.naves, 'Ancho de nave / Span width (m)', g.ancho_nave],
      ['Largo / Length (m)', g.largo, 'Separación de pórticos / Bay spacing (m)', g.sep_porticos],
      ['Altura a canal / Gutter height (m)', g.altura_canal, 'Altura a cumbrera / Ridge height (m)', g.altura_cumbrera],
      ['Superficie / Area (m²)', Math.round(g.area)],
      ['Indiquen precio unitario y plazo de entrega. / Please quote unit price and lead time.'],
      [],
      ['Partida / Item', 'Referencia / Ref.', 'Descripción / Description', 'Especificación / Specification',
        'Cantidad / Qty', 'Unidad / Unit', 'Longitud / Length (m)', 'Peso / Weight (kg)', 'Precio unitario / Unit price', 'Observaciones / Remarks']
    ];
    for (const l of r.lineas) {
      const pct = esPorcentaje(l);
      rfq.push([
        l.nombre, l.ref || '', l.texto || '', especificacion(catalogo, l),
        pct ? '' : { v: l.metros !== undefined ? Math.round(l.kg * 100) / 100 : l.cantidad, z: l.unidad === 'ud' ? ENTERO : NUM },
        pct ? '' : l.unidad,
        l.metros !== undefined ? { v: Math.round(l.metros * 100) / 100, z: NUM } : '',
        l.kg ? { v: Math.round(l.kg * 100) / 100, z: ENTERO } : '',
        '', ''
      ]);
    }
    const oferta = hoja(XLSX, rfq, [30, 14, 40, 40, 14, 10, 16, 14, 18, 30]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, materiales, 'Materiales');
    XLSX.utils.book_append_sheet(wb, oferta, 'Petición de oferta');
    wb.Props = { Title: `Lista de materiales ${proyecto.codigo || ''}`.trim(), Author: emp.nombre || '', Company: emp.nombre || '' };
    return wb;
  }

  function descargar(XLSX, datos, nombre) {
    XLSX.writeFile(libro(XLSX, datos), nombre);
  }

  const API = { libro, descargar, especificacion };
  raiz.EXCEL = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
