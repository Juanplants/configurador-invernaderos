// ============================================================
// Optimizador de implantación (fase 6)
// ============================================================
// const r = OPTIMIZADOR.buscar({ anillos, catalogo, holgura, perfil, base })
//   anillos: parcela en metros (PARCELA.leer / PARCELA.rectangulo)
//   holgura: distancia mínima del invernadero a los linderos (m)
//   perfil: 'equilibrado' | 'aprovechar' | 'minimo_coste' | 'clima' (o pesos propios)
//   base: resto del proyecto para el motor (seleccion, opcionales, puertas, zona, sitio)
// → { mejores: [3 candidatas distintas en modelo o nº de naves], candidatas, todas, avisos }
//
// 1. Para cada orientación (cada 5°) se rasteriza la parcela en el marco girado
//    y se buscan los rectángulos útiles máximos (histograma por filas): para
//    cada anchura, la mayor altura libre. Una celda es útil si está entera
//    dentro de la parcela, fuera de los huecos y a la holgura de los linderos.
// 2. Para cada modelo apto, ancho de nave y separación, y cada nº de naves,
//    el largo libre da los tramos. Luego se ajusta con la geometría exacta
//    (la rejilla es conservadora): se prueba un tramo o una nave más.
// 3. Cada combinación distinta se calcula con el motor (€/m², ventilación) y se
//    puntúa con los pesos del perfil (especificación, apartado 5).

(function (raiz) {
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const P = raiz.PARCELA || req('./parcela.js');
  const M = raiz.MOTOR || {};
  const MOTOR = M.calcular ? M : req('../motor/motor.js');
  const GEO = M.geometria || req('../motor/geometria.js');
  const AVI = M.avisos || req('../motor/avisos.js');

  const PERFILES = {
    equilibrado:  { nombre: 'Equilibrado',           coste: 0.40, superficie: 0.30, ventilacion: 0.20, orientacion: 0.10 },
    aprovechar:   { nombre: 'Aprovechar la parcela', coste: 0.25, superficie: 0.50, ventilacion: 0.15, orientacion: 0.10 },
    minimo_coste: { nombre: 'Mínimo coste',          coste: 0.60, superficie: 0.20, ventilacion: 0.10, orientacion: 0.10 },
    clima:        { nombre: 'Clima y ventilación',   coste: 0.25, superficie: 0.20, ventilacion: 0.40, orientacion: 0.15 }
  };
  // Orientación preferida de la cumbrera (lado largo): norte-sur. La puntuación
  // es |cos(azimut − preferido)|: 1 en N-S, 0 en E-O.
  const ORIENTACION_PREFERIDA = 0;
  const PASO = 5;          // grados entre orientaciones
  const CELDAS = 220;      // celdas en el lado mayor de la rejilla
  const TRAMOS_MIN = 2;

  const rad = (g) => g * Math.PI / 180;
  const puntuaOrientacion = (azimut) => Math.abs(Math.cos(rad(azimut - ORIENTACION_PREFERIDA)));

  // Marco girado: Y a lo largo del azimut β (el largo del invernadero), X perpendicular
  function marco(beta) {
    const d = [Math.sin(rad(beta)), Math.cos(rad(beta))], e = [d[1], -d[0]];
    return {
      aMarco: ([x, y]) => [x * e[0] + y * e[1], x * d[0] + y * d[1]],
      aMundo: ([X, Y]) => [X * e[0] + Y * d[0], X * e[1] + Y * d[1]]
    };
  }

  // Rejilla de celdas útiles en el marco de β y su «escalera»: para cada anchura
  // (en celdas), la mayor altura libre y dónde está
  function escalera(anillos, beta, holgura) {
    const m = marco(beta);
    const an = anillos.map(a => a.map(m.aMarco));
    const xs = an[0].map(p => p[0]), ys = an[0].map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const extension = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
    const celda = Math.max(0.25, extension / CELDAS);
    const nx = Math.ceil((Math.max(...xs) - x0) / celda), ny = Math.ceil((Math.max(...ys) - y0) / celda);
    const lados = an.flatMap(P.aristas);
    const margen = holgura + celda * Math.SQRT1_2;
    const altura = new Int32Array(nx);
    const mejor = new Array(nx + 2).fill(null); // mejor[w] = { h, col, fila, ancho } (ancho real ≥ w)
    for (let j = 0; j < ny; j++) {
      const cy = y0 + (j + 0.5) * celda;
      for (let i = 0; i < nx; i++) {
        const c = [x0 + (i + 0.5) * celda, cy];
        let libre = P.dentro(c, an[0]) && !an.slice(1).some(h => P.dentro(c, h));
        if (libre) for (const [a, b] of lados) { if (P.distPuntoSegmento(c, a, b) < margen) { libre = false; break; } }
        altura[i] = libre ? altura[i] + 1 : 0;
      }
      // Rectángulos máximos que acaban en esta fila (pila de alturas)
      const pila = [];
      for (let i = 0; i <= nx; i++) {
        const h = i < nx ? altura[i] : 0;
        let inicio = i;
        while (pila.length && pila[pila.length - 1].h >= h) {
          const top = pila.pop();
          const w = i - top.inicio;
          if (top.h > 0 && (!mejor[w] || top.h > mejor[w].h)) mejor[w] = { h: top.h, col: top.inicio, fila: j, ancho: w };
          inicio = top.inicio;
        }
        pila.push({ h, inicio });
      }
    }
    for (let w = nx - 1; w >= 1; w--) if (mejor[w + 1] && (!mejor[w] || mejor[w + 1].h > mejor[w].h)) mejor[w] = mejor[w + 1];
    // Para una anchura en metros: altura libre en metros y centro (en el mundo) del rectángulo que la da
    return (anchoM) => {
      const w = Math.ceil(anchoM / celda - 1e-9);
      const r = mejor[w];
      if (!r || w < 1) return null;
      const X = x0 + (r.col + r.ancho / 2) * celda, Y = y0 + (r.fila + 1 - r.h / 2) * celda;
      return { alto: r.h * celda, centro: m.aMundo([X, Y]), celda };
    };
  }

  // Ajuste exacto: el rectángulo cumple la holgura; prueba desplazamientos pequeños
  function ajustar(anillos, rect, holgura, desplaz) {
    const d = [Math.sin(rad(rect.azimut)), Math.cos(rad(rect.azimut))], e = [d[1], -d[0]];
    const pasos = [0, 1, -1, 2, -2, 4, -4];
    for (const a of pasos) for (const b of pasos) {
      const r = Object.assign({}, rect, { cx: rect.cx + a * desplaz * d[0] + b * desplaz * e[0], cy: rect.cy + a * desplaz * d[1] + b * desplaz * e[1] });
      const h = P.holguraRect(anillos, r);
      if (h.distancia >= holgura - 1e-6) return Object.assign(r, { holgura: h.distancia });
    }
    return null;
  }

  // Opciones del proyecto válidas para un modelo (las de otro modelo se descartan)
  function seleccionPara(catalogo, modelo, seleccion = {}) {
    const comps = catalogo.componentes.filter(c => String(c.modelos || '').split(';').map(s => s.trim()).includes(modelo.id));
    const r = {};
    for (const [g, id] of Object.entries(seleccion)) {
      if (id === null || comps.some(c => c.id === id && c.grupo_alternativas === g)) r[g] = id;
    }
    return r;
  }

  // pesos: opcional, sustituye al perfil ({ coste, superficie, ventilacion, orientacion })
  function buscar({ anillos, catalogo, holgura = 0, perfil = 'equilibrado', pesos: propios = null, base = {}, cuantas = 3 }) {
    const pesos = propios || PERFILES[perfil] || PERFILES.equilibrado;
    const avisos = [];
    const modelos = catalogo.modelos.filter(m => {
      const apto = AVI.emplazamiento(m, base.sitio);
      if (apto && apto.resultado === 'no_apto') { avisos.push(`${m.nombre}: no apto para el viento del emplazamiento; se descarta.`); return false; }
      return true;
    });
    // 1-2. Candidatas geométricas, una por combinación de medidas (la de mejor orientación)
    const porMedidas = new Map();
    for (let beta = 0; beta < 180; beta += PASO) {
      const libre = escalera(anillos, beta, holgura);
      for (const m of modelos) {
        const maxN = m.max_naves || 50, maxL = m.max_longitud || Infinity;
        for (const w of GEO.lista(m.anchos_de_nave_admitidos)) {
          for (const s of GEO.lista(m.separaciones_entre_porticos)) {
            for (let n = 1; n <= maxN; n++) {
              const hueco = libre(n * w);
              if (!hueco) break; // más naves tampoco caben
              let t = Math.min(Math.floor(hueco.alto / s + 1e-9), Math.floor(maxL / s + 1e-9));
              if (t < TRAMOS_MIN) continue;
              let rect = ajustar(anillos, { cx: hueco.centro[0], cy: hueco.centro[1], azimut: beta, largo: t * s, ancho: n * w }, holgura, hueco.celda);
              if (!rect) continue;
              // Un tramo más, si la geometría exacta lo permite
              while ((t + 1) * s <= maxL) {
                const mas = ajustar(anillos, Object.assign({}, rect, { largo: (t + 1) * s }), holgura, s / 2);
                if (!mas) break;
                rect = mas; t++;
              }
              const clave = `${m.id}|${w}|${s}|${n}|${t}`;
              const previa = porMedidas.get(clave);
              const orient = puntuaOrientacion(beta);
              if (!previa || orient > previa.orientacion + 1e-9) {
                porMedidas.set(clave, { modelo: m, ancho_nave: w, separacion: s, naves: n, tramos: t, azimut: beta, orientacion: orient, implantacion: rect });
              }
            }
          }
        }
      }
    }
    // 3. Motor y puntuación
    const candidatas = [];
    for (const c of porMedidas.values()) {
      const r = MOTOR.calcular(catalogo, {
        modelo: c.modelo.id, naves: c.naves, tramos: c.tramos, ancho_nave: c.ancho_nave, separacion: c.separacion,
        altura_canal: GEO.lista(c.modelo.alturas_a_canal_admitidas)[0], puertas: base.puertas ?? 1,
        seleccion: seleccionPara(catalogo, c.modelo, base.seleccion), opcionales: base.opcionales || [], zona: base.zona, sitio: base.sitio
      });
      if (r.avisos.some(a => a.nivel === 'rojo' && (a.codigo === 'rango' || a.codigo === 'error'))) continue;
      if (!Number.isFinite(r.precio.eur_m2)) continue;
      candidatas.push(Object.assign(c, {
        area: r.geometria.area, largo: r.geometria.largo, ancho: r.geometria.ancho_total,
        eur_m2: r.precio.eur_m2, total: r.precio.total, ventilacion: r.ventilacion.pct_total, ventilacion_cenital: r.ventilacion.pct_cenital
      }));
    }
    if (!candidatas.length) return { mejores: [], candidatas: 0, todas: [], perfil: pesos.nombre || 'Personalizado', pesos, avisos: avisos.concat(['No cabe ningún invernadero en la parcela con esa distancia a los linderos.']) };
    const rango = (k) => { const v = candidatas.map(c => c[k]); return [Math.min(...v), Math.max(...v)]; };
    const [cMin, cMax] = rango('eur_m2'), [, aMax] = rango('area'), [vMin, vMax] = rango('ventilacion');
    for (const c of candidatas) {
      c.detalle = {
        coste: cMax > cMin ? (cMax - c.eur_m2) / (cMax - cMin) : 1,
        superficie: c.area / aMax,
        ventilacion: vMax > vMin ? (c.ventilacion - vMin) / (vMax - vMin) : 1,
        orientacion: c.orientacion
      };
      c.puntuacion = pesos.coste * c.detalle.coste + pesos.superficie * c.detalle.superficie
        + pesos.ventilacion * c.detalle.ventilacion + pesos.orientacion * c.detalle.orientacion;
    }
    candidatas.sort((a, b) => b.puntuacion - a.puntuacion || b.area - a.area);
    // Las mejores, distintas de verdad: una por modelo y nº de naves
    const vistas = new Set(), mejores = [];
    for (const c of candidatas) {
      const k = `${c.modelo.id}|${c.naves}`;
      if (vistas.has(k)) continue;
      vistas.add(k);
      mejores.push(c);
      if (mejores.length === cuantas) break;
    }
    return { mejores, candidatas: candidatas.length, todas: candidatas, avisos, perfil: pesos.nombre || 'Personalizado', pesos };
  }

  // Coloca unas medidas fijas (largo × ancho) en la parcela: la orientación con mejor
  // puntuación en la que caben. null si no caben con la holgura pedida.
  function encajar(anillos, largo, ancho, holgura = 0) {
    const opciones = [];
    for (let beta = 0; beta < 180; beta += PASO) {
      const hueco = escalera(anillos, beta, holgura)(ancho);
      if (hueco && hueco.alto >= largo - 1e-9) opciones.push({ beta, hueco });
    }
    opciones.sort((a, b) => puntuaOrientacion(b.beta) - puntuaOrientacion(a.beta) || (b.hueco.alto - a.hueco.alto));
    for (const { beta, hueco } of opciones) {
      const r = ajustar(anillos, { cx: hueco.centro[0], cy: hueco.centro[1], azimut: beta, largo, ancho }, holgura, hueco.celda);
      if (r) return r;
    }
    return null;
  }

  const API = { buscar, encajar, PERFILES, ORIENTACION_PREFERIDA, PASO, puntuaOrientacion, escalera };
  raiz.OPTIMIZADOR = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
