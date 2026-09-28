// ============================================================
// 4. Precios
// ============================================================
// Subtotales por categoría, obra local por zona, IVA y totales.
// La capa de importación (FOB, flete, aranceles, margen) queda fuera
// de la v0.4: se añadirá aquí cuando lleguen presupuestos de fábrica.

(function (raiz) {
  function calcular(catalogo, proyecto, g, lineas) {
    const categorias = {};
    for (const l of lineas) {
      categorias[l.categoria] = (categorias[l.categoria] || 0) + (l.importe || 0);
    }
    const materiales = Object.values(categorias).reduce((s, x) => s + x, 0);

    let obra = null;
    const zona = (catalogo.obra_local || []).find(z => z.zona === proyecto.zona);
    if (zona) {
      const pilaresTot = g.pilares + g.pilares_hastial;
      obra = {
        zona: zona.zona,
        movilizacion: zona.movilizacion || 0,
        montaje: (zona.montaje || 0) * g.area,
        hoyos: (zona.hoyos_y_dados || 0) * pilaresTot,
        origen: zona.origen
      };
      obra.total = obra.movilizacion + obra.montaje + obra.hoyos;
    }

    const ivaPct = (catalogo.empresa && catalogo.empresa.iva !== undefined) ? catalogo.empresa.iva / 100 : 0.21;
    const base = materiales + (obra ? obra.total : 0);
    const kgAcero = lineas.reduce((s, l) => s + (l.kg || 0), 0);
    return {
      moneda: (catalogo.empresa && catalogo.empresa.moneda) || 'EUR',
      categorias, materiales, obra,
      base_imponible: base,
      iva: base * ivaPct, iva_pct: ivaPct,
      total: base * (1 + ivaPct),
      eur_m2: g.area ? base / g.area : 0,
      kg_acero: kgAcero,
      kg_acero_m2: g.area ? kgAcero / g.area : 0
    };
  }

  const API = { calcular };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, { precios: API });
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
