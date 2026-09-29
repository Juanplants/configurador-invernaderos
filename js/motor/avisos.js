// ============================================================
// 2 y 5. Comprobación del emplazamiento y avisos
// ============================================================

(function (raiz) {
  const GEO = raiz.MOTOR?.geometria || (typeof require !== 'undefined' && require('./geometria.js'));

  const CONFIG = {
    ventilacion_ambar: 0.20,   // % de superficie efectiva sobre el suelo
    ventilacion_rojo: 0.15,
    margen_limite: 0.10,       // "al límite" si la carga del sitio está a menos del 10 % de la declarada
    proyecto_grande_m2: 50000
  };

  // Aptitud del modelo para el sitio: compara viento (km/h) y nieve (kg/m²)
  function emplazamiento(modelo, sitio, cfg = CONFIG) {
    if (!sitio || (sitio.viento_kmh === undefined && sitio.nieve === undefined && !sitio.nieve_fuera)) return null;
    const comprobar = (sitioV, declarado) => {
      if (sitioV === undefined || declarado === undefined) return 'apto';
      if (sitioV > declarado) return 'no_apto';
      if (sitioV > declarado * (1 - cfg.margen_limite)) return 'al_limite';
      return 'apto';
    };
    const viento = comprobar(sitio.viento_kmh, modelo.viento_cerrado);
    // Nieve: si el sitio tiene y el fabricante no declara ninguna (vacío o 0), no se
    // puede comparar: «sin_dato», con aviso, en vez de dar por buena o mala la carga
    // Fuera de la tabla E.2 (por encima de la última altitud con dato de la zona): requiere estudio
    const nieve = sitio.nieve_fuera ? 'fuera_tabla'
      : !((sitio.nieve || 0) > 0) ? 'apto' : (modelo.nieve > 0 ? comprobar(sitio.nieve, modelo.nieve) : 'sin_dato');
    const orden = ['apto', 'al_limite', 'no_apto'];
    const resultado = orden[Math.max(orden.indexOf(viento), orden.indexOf(nieve === 'sin_dato' || nieve === 'fuera_tabla' ? 'apto' : nieve))];
    return { resultado, viento, nieve };
  }

  function generar({ modelo, proyecto, g, vent, lineas, apto, errores }, cfg = CONFIG) {
    const avisos = [];
    const pct = (x) => (x * 100).toFixed(1) + ' %';

    if (vent.pct_total < cfg.ventilacion_rojo) {
      avisos.push({ nivel: 'rojo', codigo: 'ventilacion', texto: `Ventilación efectiva ${pct(vent.pct_total)} del suelo (cenital ${pct(vent.pct_cenital)}), por debajo del ${pct(cfg.ventilacion_rojo)}` });
    } else if (vent.pct_total < cfg.ventilacion_ambar) {
      avisos.push({ nivel: 'ambar', codigo: 'ventilacion', texto: `Ventilación efectiva ${pct(vent.pct_total)} del suelo (cenital ${pct(vent.pct_cenital)}), por debajo del ${pct(cfg.ventilacion_ambar)}` });
    }
    if (vent.lineas_cenital === 0) {
      avisos.push({ nivel: 'ambar', codigo: 'sin_cenital', texto: 'Sin ventilación cenital: en invernaderos anchos los laterales no ventilan el centro' });
    }

    const admite = (valor, campo) => GEO.lista(modelo[campo]).some(v => Math.abs(v - valor) < 1e-6);
    if (!admite(g.ancho_nave, 'anchos_de_nave_admitidos')) avisos.push({ nivel: 'rojo', codigo: 'rango', texto: `Ancho de nave ${g.ancho_nave} m no admitido por el modelo` });
    if (!admite(g.sep_porticos, 'separaciones_entre_porticos')) avisos.push({ nivel: 'rojo', codigo: 'rango', texto: `Separación entre pórticos ${g.sep_porticos} m no admitida por el modelo` });
    if (!admite(g.altura_canal, 'alturas_a_canal_admitidas')) avisos.push({ nivel: 'rojo', codigo: 'rango', texto: `Altura a canal ${g.altura_canal} m no admitida por el modelo` });
    if (modelo.max_naves && g.naves > modelo.max_naves) avisos.push({ nivel: 'rojo', codigo: 'rango', texto: `${g.naves} naves supera el máximo del modelo (${modelo.max_naves})` });
    if (modelo.max_longitud && g.largo > modelo.max_longitud) avisos.push({ nivel: 'rojo', codigo: 'rango', texto: `Longitud ${g.largo} m supera el máximo del modelo (${modelo.max_longitud} m)` });

    if (apto && apto.resultado !== 'apto') {
      avisos.push({ nivel: apto.resultado === 'no_apto' ? 'rojo' : 'ambar', codigo: 'emplazamiento',
        texto: apto.resultado === 'no_apto' ? 'El modelo no alcanza las cargas del emplazamiento: requiere cálculo específico' : 'El modelo va al límite de las cargas del emplazamiento' });
    }
    if (apto && apto.nieve === 'fuera_tabla') {
      const f = proyecto.sitio.nieve_fuera;
      avisos.push({ nivel: 'ambar', codigo: 'nieve_fuera_tabla', texto: `Nieve fuera de la tabla E.2 del CTE (zona ${f.zona}, ${Math.round(f.altitud)} m; la tabla llega a ${f.ultima} m): requiere estudio` });
    }
    if (apto && apto.nieve === 'sin_dato') {
      avisos.push({ nivel: 'ambar', codigo: 'nieve_sin_dato', texto: `El sitio tiene ${Math.round(proyecto.sitio.nieve)} kg/m² de nieve y el modelo no declara carga de nieve: pedir el dato al fabricante` });
    }
    for (const l of lineas.filter(l => l.importe === null || l.importe === undefined)) {
      avisos.push({ nivel: 'ambar', codigo: 'sin_precio', texto: `${l.nombre}: sin precio en el catálogo` });
    }
    if (g.area > cfg.proyecto_grande_m2) avisos.push({ nivel: 'ambar', codigo: 'grande', texto: 'Proyecto de más de 5 ha: revisar a mano' });
    const estimados = lineas.filter(l => l.origen === 'estimado').length;
    if (estimados) avisos.push({ nivel: 'info', codigo: 'estimados', texto: `${estimados} partidas usan valores estimados, no del fabricante` });
    for (const e of errores || []) avisos.push({ nivel: 'rojo', codigo: 'error', texto: e });
    return avisos;
  }

  const API = { emplazamiento, generar, CONFIG };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, { avisos: API });
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
