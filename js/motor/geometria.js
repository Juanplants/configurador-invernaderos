// ============================================================
// 1. Geometría derivada
// ============================================================
// A partir del modelo del catálogo y de las entradas del proyecto
// calcula todas las medidas que usan las reglas de cantidad
// (ver hoja "Variables" del catálogo).

(function (raiz) {
  const lista = (v) => String(v).split(';').map(s => parseFloat(s)).filter(Number.isFinite);

  function calcular(modelo, proyecto) {
    const ancho_nave = proyecto.ancho_nave ?? lista(modelo.anchos_de_nave_admitidos)[0];
    const sep_porticos = proyecto.separacion ?? lista(modelo.separaciones_entre_porticos)[0];
    const altura_canal = proyecto.altura_canal ?? lista(modelo.alturas_a_canal_admitidas)[0];
    const flecha = modelo.flecha_del_arco;
    const naves = proyecto.naves;
    const tramos = proyecto.tramos;

    const largo = tramos * sep_porticos;
    const porticos = tramos + 1;
    const ancho_total = naves * ancho_nave;
    const area = ancho_total * largo;
    const perimetro = 2 * (ancho_total + largo);
    // Longitud de arco: aproximación parabólica √(w² + 16/3·f²)
    const arco = Math.sqrt(ancho_nave ** 2 + (16 / 3) * flecha ** 2);
    const pilares = (naves + 1) * porticos;
    const sep_hastial = modelo.sep_pilares_hastial || ancho_nave;
    const pilares_hastial = 2 * naves * Math.max(Math.round(ancho_nave / sep_hastial) - 1, 0);
    // Área del segmento parabólico del arco (⅔·base·flecha)
    const area_arco = (2 / 3) * ancho_nave * flecha;
    const area_cubierta = naves * arco * largo;
    const area_cerramiento = 2 * largo * altura_canal + 2 * (ancho_total * altura_canal + naves * area_arco);
    const volumen = area * altura_canal + naves * area_arco * largo;
    const long_ventana_cenital = Math.max(largo - 2 * sep_porticos, 0);

    return {
      naves, tramos, porticos, ancho_nave, sep_porticos, altura_canal, flecha,
      largo, ancho_total, area, perimetro, arco, pilares, pilares_hastial,
      area_cubierta, area_cerramiento, volumen, long_ventana_cenital,
      altura_cumbrera: altura_canal + flecha,
      ancho_hoja: modelo.ancho_hoja_cenital || 0,
      kg_arriostramiento: modelo.arriostramiento || 0,
      puertas: proyecto.puertas ?? 1
    };
  }

  // Superficie de ventanas y de ventilación efectiva, según las ventanas elegidas.
  // cenital/lateral: fila de la hoja Equipos (tipo ventana) o null; malla: fila de Cubiertas o null.
  function ventilacion(g, cenital, lateral, malla) {
    const factor = malla && malla.factor_paso_de_aire ? malla.factor_paso_de_aire : 1;
    const lineas = cenital ? (cenital.lineas_por_nave || 1) : 0;
    const hoja_m2 = g.naves * lineas * g.long_ventana_cenital * g.ancho_hoja;
    // Rendija de apertura ≈ recorrido útil de la cremallera (sin superar el ancho de hoja)
    const rendija = cenital ? Math.min(cenital.recorrido_cremallera || g.ancho_hoja, g.ancho_hoja) : 0;
    const cen_geo = g.naves * lineas * g.long_ventana_cenital * rendija;
    const lat_geo = lateral ? 2 * g.largo * (lateral.alto_ventana || 0) : 0;
    const cen_ef = cen_geo * factor;
    const lat_ef = lat_geo * factor;
    return {
      lineas_cenital: lineas,
      superficie_ventanas: hoja_m2 + lat_geo,
      cenital_geometrica: cen_geo, lateral_geometrica: lat_geo,
      cenital_efectiva: cen_ef, lateral_efectiva: lat_ef,
      pct_cenital: g.area ? cen_ef / g.area : 0,
      pct_total: g.area ? (cen_ef + lat_ef) / g.area : 0,
      factor_malla: factor
    };
  }

  const API = { calcular, ventilacion, lista };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, { geometria: API });
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
