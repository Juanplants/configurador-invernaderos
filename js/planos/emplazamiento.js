// ============================================================
// Hoja A3 de emplazamiento (05)
// ============================================================
// PLANOS_A3.emplazamiento({ g, modelo, empresa, proyecto, fecha,
//   parcela: { largo, ancho, orientacion, girado } })
//   largo, ancho: m; orientacion: azimut del lado largo de la parcela, en grados
//   desde el norte (sentido horario); girado: invernadero a 90° de la parcela.
// → { svg, viewBox, escala, cajas, fallos, dibujo, cabe, encaje }
//
// Parcela rectangular introducida a mano, o polígono real del Catastro (GML/KML)
// con `terreno`: { anillos, meta, implantacion, retranqueo, camino } (fase 6).
// El invernadero va centrado, con su largo paralelo al largo de la parcela
// (o girado 90°). Se acotan las distancias a los cuatro linderos. Si no cabe,
// se dibuja igual, sin distancias, con un aviso y cuánto falta.

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const PAR = raiz.PARCELA || (typeof require !== 'undefined' && require('../terreno/parcela.js'));
  const { DIBUJO, LINEA } = H;

  const BANDA = { arriba: 20, izquierda: 12, abajo: 22, derecha: 22, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;
  const EPS = 0.005; // m: una distancia menor se trata como 0 (invernadero pegado al lindero)

  // Geometría del encaje, en ejes del papel (x = lado más largo de la parcela)
  function encaje(g, parcela) {
    const { largo: PL, ancho: PA, orientacion = 0, girado = false, holgura = 0 } = parcela;
    const parcelaLargoEnX = PL >= PA;
    const Lg = girado ? g.ancho_total : g.largo;       // invernadero a lo largo de la parcela
    const Ag = girado ? g.largo : g.ancho_total;       // y a lo ancho
    const PX = parcelaLargoEnX ? PL : PA, PY = parcelaLargoEnX ? PA : PL;
    const GX = parcelaLargoEnX ? Lg : Ag, GY = parcelaLargoEnX ? Ag : Lg;
    const dx = (PX - GX) / 2, dy = (PY - GY) / 2;
    // Cabe si deja al menos la holgura (retranqueo / camino) a cada lindero
    const cabe = dx >= holgura - 1e-9 && dy >= holgura - 1e-9;
    // Azimut del eje x del papel y ángulo del norte en el papel (grados desde arriba, horario)
    const azX = parcelaLargoEnX ? orientacion : orientacion - 90;
    const norte = ((90 - azX) % 360 + 360) % 360;
    return {
      cabe, PX, PY, GX, GY, dx, dy, norte,
      invernaderoLargoEnX: parcelaLargoEnX !== !!girado,
      // Azimut del largo del invernadero (para el norte de la planta)
      azimutInvernadero: (((girado ? orientacion + 90 : orientacion) % 360) + 360) % 360,
      faltaLargo: Math.max(0, Lg + 2 * holgura - PL), faltaAncho: Math.max(0, Ag + 2 * holgura - PA), holgura,
      ocupacion: (g.largo * g.ancho_total) / (PL * PA)
    };
  }

  function emplazamiento(datos) {
    if (datos.terreno && datos.terreno.anillos) return H.mejorEscala((e) => dibujarPoligono(datos, e));
    return H.mejorEscala((e) => dibujarEmplazamiento(datos, e));
  }

  function dibujarEmplazamiento({ g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', parcela }, escala) {
    const e = encaje(g, parcela);
    const reg = new H.Registro();
    const partes = [H.fondo()];
    const fmt = H.fmtCota;

    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const k = 1000 / escala;
    const UX = Math.max(e.PX, e.GX), UY = Math.max(e.PY, e.GY);   // parcela ∪ invernadero
    const W = UX * k, Hh = UY * k;
    if (W > disp.w || Hh > disp.h) return { cabe: false, fallos: [], escala, dibujo: { w: W, h: Hh, disponible: disp }, encaje: e };
    const cx = disp.x + disp.w / 2, cy = disp.y + disp.h / 2;
    const P = { x: cx - e.PX * k / 2, y: cy - e.PY * k / 2, w: e.PX * k, h: e.PY * k };
    const G = { x: cx - e.GX * k / 2, y: cy - e.GY * k / 2, w: e.GX * k, h: e.GY * k };
    const U = { x: cx - W / 2, y: cy - Hh / 2, w: W, h: Hh };

    // --- Dibujo ---
    const dib = [];
    dib.push(`<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="#fafafa" stroke="none"/>`);
    dib.push(`<rect x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" fill="#e6e6e6" stroke="#000" stroke-width="${LINEA.contorno}"/>`);
    // Canales: una línea por cada límite entre naves, a lo largo del invernadero
    for (let j = 1; j < g.naves; j++) {
      const t = j / g.naves;
      dib.push(e.invernaderoLargoEnX
        ? H.linea(G.x, G.y + t * G.h, G.x + G.w, G.y + t * G.h, LINEA.cumbrera)
        : H.linea(G.x + t * G.w, G.y, G.x + t * G.w, G.y + G.h, LINEA.cumbrera));
    }
    // Lindero encima, a trazo y punto grueso
    dib.push(`<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="none" stroke="#000" stroke-width="0.6" stroke-dasharray="6 1.5 1 1.5"/>`);
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    reg.ocupar({ x: U.x - 0.3, y: U.y - 0.3, w: U.w + 0.6, h: U.h + 0.6 }, 'dibujo');

    // --- Cotas: totales de la parcela por fuera; por dentro, lindero–invernadero–lindero ---
    const abajo = U.y + U.h + 0.3, derecha = U.x + U.w + 0.3;
    const cadenaCon = (eje, a0, a1, g0, g1, d, tamG, origen, nombre) => {
      // posiciones y vanos saltando las distancias nulas (invernadero pegado al lindero)
      const pos = [a0], val = [];
      if (d > EPS) { pos.push(g0); val.push(d); }
      pos.push(g1); val.push(tamG);
      if (d > EPS) { pos.push(a1); val.push(d); }
      if (pos.length > 2) partes.push(H.cadena(reg, { eje, posiciones: pos, valores: val, origen, linea: origen + COTA_1, limite: DIBUJO, nombre }));
    };
    const total = (eje, a0, a1, v, origen, desplaz, nombre) =>
      partes.push(H.cadena(reg, { eje, posiciones: [a0, a1], valores: [v], origen, linea: origen + desplaz, limite: DIBUJO, nombre }));
    if (e.cabe) {
      total('h', P.x, P.x + P.w, e.PX, abajo, COTA_2, 'parcela total');
      cadenaCon('h', P.x, P.x + P.w, G.x, G.x + G.w, e.dx, e.GX, abajo, 'lindero');
      total('v', P.y, P.y + P.h, e.PY, derecha, COTA_2, 'parcela total');
      cadenaCon('v', P.y, P.y + P.h, G.y, G.y + G.h, e.dy, e.GY, derecha, 'lindero');
    } else {
      // Sin distancias: parcela e invernadero, cada uno con su total
      total('h', P.x, P.x + P.w, e.PX, abajo, COTA_1, 'parcela total');
      total('h', G.x, G.x + G.w, e.GX, abajo, COTA_2, 'invernadero total');
      total('v', P.y, P.y + P.h, e.PY, derecha, COTA_1, 'parcela total');
      total('v', G.y, G.y + G.h, e.GY, derecha, COTA_2, 'invernadero total');
      const t = 'EL INVERNADERO NO CABE EN LA PARCELA';
      partes.push(H.textoRegistrado(reg, [{ x: cx, y: U.y - 3 }, { x: cx, y: U.y - 9 }], t, 3.5, { limite: DIBUJO, tipo: 'rotulo', peso: 700, nombre: 'no cabe' }));
    }

    // --- Rótulos (opcionales: el dato va también en las notas) ---
    partes.push(H.rotulo(reg, { px: G.x + G.w * 0.75, py: G.y + G.h / 2, texto: 'Invernadero', largo: U.x + U.w - (G.x + G.w * 0.75) + 6, arriba: U.y, limite: DIBUJO, nombre: 'invernadero', obligatoria: false }));
    partes.push(H.rotulo(reg, { px: P.x + P.w * 0.1, py: P.y, texto: 'Lindero de la parcela', largo: 8, arriba: U.y, limite: DIBUJO, nombre: 'lindero', obligatoria: false }));

    // --- Leyenda y cajetín ---
    const m2 = (v) => Math.round(v).toLocaleString('es-ES');
    const notas = [
      `Parcela ${fmt(parcela.largo)} × ${fmt(parcela.ancho)} m (${m2(parcela.largo * parcela.ancho)} m²); lado largo a ${Math.round(parcela.orientacion || 0)}° del norte.`,
      e.cabe
        ? `Invernadero centrado${parcela.girado ? ', girado 90°' : ''}: a ${fmt(e.dx)} y ${fmt(e.dy)} m de los linderos; ocupa el ${Math.round(e.ocupacion * 100)} % de la parcela.`
        : `No cabe${e.holgura ? ` dejando ${fmt(e.holgura)} m a los linderos` : ''}: faltan ${[e.faltaLargo > 0 ? `${fmt(e.faltaLargo)} m a lo largo` : '', e.faltaAncho > 0 ? `${fmt(e.faltaAncho)} m a lo ancho` : ''].filter(Boolean).join(' y ')} de la parcela.`,
      e.holgura ? `Distancia mínima exigida a los linderos (retranqueo o camino perimetral): ${fmt(e.holgura)} m.` : '',
      'Parcela rectangular introducida a mano; para la real, carga el GML o KML del Catastro.'
    ];
    partes.push(H.hojaBase(reg, {
      escala, g, modelo, empresa, proyecto, fecha, notas: notas.filter(Boolean), norte: e.norte,
      titulo: 'EMPLAZAMIENTO', numero: '05',
      simbolos: [
        [`<line x1="-4" y1="0" x2="4" y2="0" stroke="#000" stroke-width="0.6" stroke-dasharray="3 1 0.6 1"/>`, 'Lindero'],
        [`<rect x="-4" y="-1" width="8" height="2" fill="#e6e6e6" stroke="#000" stroke-width="${LINEA.contorno}"/>`, 'Invernadero'],
        [H.linea(-4, 0, 4, 0, LINEA.cumbrera), 'Canal']
      ]
    }));

    return {
      svg: partes.join(''), viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos, cabe: true, encaje: e,
      dibujo: { x: U.x, y: U.y, w: W, h: Hh, disponible: disp }
    };
  }

  // ---------- Parcela real (polígono del Catastro) ----------
  // Todo se gira para que el largo del invernadero quede en horizontal;
  // la flecha del norte gira con él. Coordenadas locales: x al este, y al norte (m).
  function encajePoligono(g, terreno) {
    const { anillos, implantacion: imp = null, retranqueo = 0, camino = 0 } = terreno;
    const holgura = Math.max(+retranqueo || 0, +camino || 0);
    const azimut = imp ? imp.azimut : 90;
    const rect = imp ? { cx: imp.cx, cy: imp.cy, azimut, largo: g.largo, ancho: g.ancho_total } : null;
    const h = rect ? PAR.holguraRect(anillos, rect) : { distancia: -1 };
    const superficie = PAR.area(anillos[0]) - anillos.slice(1).reduce((s, h) => s + PAR.area(h), 0);
    return {
      cabe: !!rect && h.distancia >= holgura - 1e-6, colocado: !!rect, rect, holgura, retranqueo: +retranqueo || 0, camino: +camino || 0,
      distancia: h.distancia, desde: h.desde, hasta: h.hasta, superficie,
      azimutInvernadero: ((azimut % 360) + 360) % 360,
      norte: (((90 - azimut) % 360) + 360) % 360,
      ocupacion: rect ? g.largo * g.ancho_total / superficie : 0
    };
  }

  function dibujarPoligono({ g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', terreno }, escala) {
    const e = encajePoligono(g, terreno);
    const reg = new H.Registro();
    const partes = [H.fondo()];
    const fmt = H.fmtCota;
    const m2 = (v) => Math.round(v).toLocaleString('es-ES');
    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const k = 1000 / escala;
    const s = Math.sin(e.azimutInvernadero * Math.PI / 180), c = Math.cos(e.azimutInvernadero * Math.PI / 180);
    const giro = ([x, y]) => [x * s + y * c, x * c - y * s];   // papel: X a lo largo del invernadero, Y hacia abajo
    const anillos = terreno.anillos.map(a => a.map(giro));
    const inv = e.rect ? PAR.esquinas(e.rect).map(giro) : [];
    const banda = e.rect && e.camino > 0
      ? PAR.esquinas(Object.assign({}, e.rect, { largo: g.largo + 2 * e.camino, ancho: g.ancho_total + 2 * e.camino })).map(giro) : [];
    const todos = anillos[0].concat(inv, banda);
    const x0 = Math.min(...todos.map(p => p[0])), x1 = Math.max(...todos.map(p => p[0]));
    const y0 = Math.min(...todos.map(p => p[1])), y1 = Math.max(...todos.map(p => p[1]));
    const W = (x1 - x0) * k, Hh = (y1 - y0) * k;
    if (W > disp.w || Hh > disp.h) return { cabe: false, fallos: [], escala, dibujo: { w: W, h: Hh, disponible: disp }, encaje: e };
    const U = { x: disp.x + (disp.w - W) / 2, y: disp.y + (disp.h - Hh) / 2, w: W, h: Hh };
    const P = ([x, y]) => [U.x + (x - x0) * k, U.y + (y - y0) * k];
    const n = (v) => Math.round(v * 1000) / 1000;
    const camino = (pts) => 'M' + pts.map(P).map(([x, y]) => `${n(x)},${n(y)}`).join(' L') + ' Z';

    // --- Dibujo ---
    const dib = [];
    const contorno = anillos.map(camino).join(' ');
    dib.push(`<path d="${contorno}" fill="#fafafa" fill-rule="evenodd" stroke="none"/>`);
    if (banda.length) dib.push(`<path d="${camino(banda)}" fill="#f0f0f0" stroke="#000" stroke-width="${LINEA.cota}" stroke-dasharray="2 1"/>`);
    let G = null;
    if (inv.length) {
      const q = inv.map(P);
      G = { x: Math.min(...q.map(p => p[0])), y: Math.min(...q.map(p => p[1])) };
      G.w = Math.max(...q.map(p => p[0])) - G.x; G.h = Math.max(...q.map(p => p[1])) - G.y;
      dib.push(`<rect x="${n(G.x)}" y="${n(G.y)}" width="${n(G.w)}" height="${n(G.h)}" fill="#e6e6e6" stroke="#000" stroke-width="${LINEA.contorno}"/>`);
      for (let j = 1; j < g.naves; j++) dib.push(H.linea(G.x, G.y + j / g.naves * G.h, G.x + G.w, G.y + j / g.naves * G.h, LINEA.cumbrera));
    }
    dib.push(`<path d="${contorno}" fill="none" stroke="#000" stroke-width="0.6" stroke-dasharray="6 1.5 1 1.5" stroke-linejoin="round"/>`);
    // Distancia mínima al lindero: línea entre los dos puntos más cercanos, con marcas en los extremos
    let medio = null;
    if (e.colocado && e.distancia > EPS) {
      const [a, b] = [giro(e.desde), giro(e.hasta)].map(P);
      medio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      dib.push(H.linea(a[0], a[1], b[0], b[1], LINEA.cota));
      for (const [px, py] of [a, b]) dib.push(`<circle cx="${n(px)}" cy="${n(py)}" r="0.5" fill="#000"/>`);
    }
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    reg.ocupar({ x: U.x - 0.3, y: U.y - 0.3, w: U.w + 0.6, h: U.h + 0.6 }, 'dibujo');

    // --- Cotas del invernadero, por fuera del dibujo ---
    const abajo = U.y + U.h + 0.3, derecha = U.x + U.w + 0.3;
    if (G) {
      partes.push(H.cadena(reg, { eje: 'h', posiciones: [G.x, G.x + G.w], valores: [g.largo], origen: abajo, linea: abajo + COTA_1, limite: DIBUJO, nombre: 'invernadero total' }));
      partes.push(H.cadena(reg, { eje: 'v', posiciones: [G.y, G.y + G.h], valores: [g.ancho_total], origen: derecha, linea: derecha + COTA_1, limite: DIBUJO, nombre: 'invernadero total' }));
    }
    if (!e.cabe) {
      const t = e.colocado ? 'EL INVERNADERO NO CUMPLE LA DISTANCIA A LINDEROS' : 'EL INVERNADERO NO CABE EN LA PARCELA';
      partes.push(H.textoRegistrado(reg, [{ x: U.x + U.w / 2, y: U.y - 3 }, { x: U.x + U.w / 2, y: U.y - 9 }], t, 3.5, { limite: DIBUJO, tipo: 'rotulo', peso: 700, nombre: 'no cabe' }));
    }

    // --- Rótulos (opcionales: el dato va también en las notas) ---
    if (medio) partes.push(H.rotulo(reg, { px: medio[0], py: medio[1], texto: `Distancia mínima al lindero ${fmt(e.distancia)} m`, largo: Math.min(U.x + U.w - medio[0], medio[0] - U.x) + 6, arriba: U.y, limite: DIBUJO, nombre: 'distancia mínima', obligatoria: false }));
    if (G) partes.push(H.rotulo(reg, { px: G.x + G.w * 0.75, py: G.y + G.h / 2, texto: 'Invernadero', largo: U.x + U.w - (G.x + G.w * 0.75) + 6, arriba: U.y, limite: DIBUJO, nombre: 'invernadero', obligatoria: false }));
    const alto = anillos[0].map(P).reduce((m, p) => p[1] < m[1] ? p : m);
    partes.push(H.rotulo(reg, { px: alto[0], py: alto[1], texto: 'Lindero de la parcela', largo: 8, arriba: U.y, limite: DIBUJO, nombre: 'lindero', obligatoria: false }));

    // --- Leyenda y cajetín ---
    const meta = terreno.meta || {};
    const origen = meta.refcat ? `ref. catastral ${meta.refcat}` : (meta.archivo || 'archivo del Catastro');
    const notas = [
      `Parcela del Catastro (${origen}): ${m2(e.superficie)} m²${meta.area_declarada ? ` (declarada ${m2(meta.area_declarada)} m²)` : ''}.`,
      `Retranqueo a linderos ${fmt(e.retranqueo)} m; camino perimetral ${fmt(e.camino)} m alrededor del invernadero.`,
      !e.colocado
        ? `No cabe: no hay sitio para ${fmt(g.largo)} × ${fmt(g.ancho_total)} m dejando ${fmt(e.holgura)} m a los linderos.`
        : e.cabe
          ? `Distancia mínima al lindero ${fmt(e.distancia)} m (exigida ${fmt(e.holgura)} m); ocupa el ${Math.round(e.ocupacion * 100)} % de la parcela.`
          : `No cumple: ${e.distancia < 0 ? 'se sale de la parcela' : `queda a ${fmt(e.distancia)} m del lindero`} y se exigen ${fmt(e.holgura)} m.`,
      e.colocado ? `Largo del invernadero a ${Math.round(e.azimutInvernadero)}° del norte.` : ''
    ];
    partes.push(H.hojaBase(reg, {
      escala, g, modelo, empresa, proyecto, fecha, notas: notas.filter(Boolean), norte: e.norte,
      titulo: 'EMPLAZAMIENTO', numero: '05',
      simbolos: [
        [`<line x1="-4" y1="0" x2="4" y2="0" stroke="#000" stroke-width="0.6" stroke-dasharray="3 1 0.6 1"/>`, 'Lindero'],
        [`<rect x="-4" y="-1" width="8" height="2" fill="#e6e6e6" stroke="#000" stroke-width="${LINEA.contorno}"/>`, 'Invernadero'],
        [H.linea(-4, 0, 4, 0, LINEA.cumbrera), 'Canal'],
        [`<rect x="-4" y="-1" width="8" height="2" fill="#f0f0f0" stroke="#000" stroke-width="${LINEA.cota}" stroke-dasharray="2 1"/>`, 'Camino perimetral'],
        [`${H.linea(-4, 0, 4, 0, LINEA.cota)}<circle cx="-4" cy="0" r="0.5"/><circle cx="4" cy="0" r="0.5"/>`, 'Distancia mínima']
      ]
    }));

    return {
      svg: partes.join(''), viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos, cabe: true, encaje: e,
      dibujo: { x: U.x, y: U.y, w: W, h: Hh, disponible: disp, invernadero: G, transformar: (p) => P(giro(p)) }
    };
  }

  const API = { emplazamiento, dibujarEmplazamiento, dibujarPoligono, encaje, encajePoligono };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
