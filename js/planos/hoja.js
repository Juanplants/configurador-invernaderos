// ============================================================
// Hoja A3 de planos: zonas, escala, registro de textos, cotas
// ============================================================
// Todo en milímetros de papel (viewBox 0 0 420 297): impreso en A3
// la escala es real. Cada texto, burbuja de eje y línea de cota se
// apunta en un registro de cajas; un texto solo se coloca donde no
// pisa nada ya apuntado. Si un texto obligatorio no cabe en ninguna
// de sus posiciones candidatas queda en `fallos` (lo vigilan las pruebas).

(function (raiz) {
  const A3 = { w: 420, h: 297 };
  // UNE-EN ISO 5457: 20 mm a la izquierda (encuadernar), 10 mm en el resto
  const MARCO = { x: 20, y: 10, w: 390, h: 277 };
  const CAJETIN = { x: MARCO.x + MARCO.w - 180, y: MARCO.y + MARCO.h - 50, w: 180, h: 50 };
  const LEYENDA = { x: MARCO.x, y: CAJETIN.y, w: CAJETIN.x - MARCO.x, h: CAJETIN.h };
  const DIBUJO = { x: MARCO.x, y: MARCO.y, w: MARCO.w, h: CAJETIN.y - MARCO.y };
  // UNE-EN ISO 5455 (serie 1-2-5); las dos últimas, fuera del rango habitual
  const ESCALAS = [20, 50, 100, 200, 500, 1000, 2000, 5000];

  // Grosores de línea (mm) por elemento
  const LINEA = {
    marco: 0.7, cajetin: 0.35, contorno: 0.5, canal: 0.35, portico: 0.25,
    cumbrera: 0.18, eje: 0.13, cota: 0.18, referencia: 0.13
  };
  const FUENTE = "'Liberation Sans', Arial, Helvetica, sans-serif";

  // ---------- Medida de textos ----------
  // Anchos por carácter en em, holgados: valen para Arial/Liberation y
  // también para DejaVu si el sistema no tiene las primeras.
  function anchoCaracter(c) {
    if ('MW'.includes(c)) return 0.95;
    if ('mw'.includes(c)) return 0.85;
    if ('il.,:;|!\'I'.includes(c)) return 0.34;
    if (c === ' ') return 0.34;
    if ('fjrt()[]'.includes(c)) return 0.45;
    if (/[0-9]/.test(c)) return 0.64;
    if (/[A-ZÁÉÍÓÚÑÜ]/.test(c)) return 0.8;
    if (/[a-záéíóúñü]/.test(c)) return 0.63;
    if (c === '×') return 0.84;
    return 0.9;
  }
  const anchoTexto = (texto, tam) => [...String(texto)].reduce((s, c) => s + anchoCaracter(c), 0) * tam;
  // Caja vertical = caja de la fuente con holgura para mayúsculas acentuadas
  // (Liberation/Arial: 0,905 + 0,212 em; medido en Chromium, ver tests/planos_navegador.js)
  const ASC = 0.97, DESC = 0.26;

  // Caja de un texto; ancla 'start' | 'middle' | 'end'; rot = 0 o -90 (se lee de abajo arriba)
  function cajaTexto(x, y, texto, tam, ancla = 'middle', rot = 0) {
    const w = anchoTexto(texto, tam);
    const d = ancla === 'start' ? 0 : ancla === 'end' ? w : w / 2;
    if (rot === -90) return { x: x - ASC * tam, y: y - w + d, w: (ASC + DESC) * tam, h: w };
    return { x: x - d, y: y - ASC * tam, w, h: (ASC + DESC) * tam };
  }

  const solapan = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6
    && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
  const dentro = (a, z) => a.x >= z.x - 1e-6 && a.y >= z.y - 1e-6
    && a.x + a.w <= z.x + z.w + 1e-6 && a.y + a.h <= z.y + z.h + 1e-6;

  // ---------- Registro de cajas ----------
  class Registro {
    constructor() { this.cajas = []; this.fallos = []; }
    libre(c, limite) {
      return (!limite || dentro(c, limite)) && this.cajas.every(o => !solapan(c, o));
    }
    // Obstáculo fijo (contorno del dibujo, líneas de cota…): se apunta sin comprobar
    ocupar(caja, tipo) {
      this.cajas.push(Object.assign({ tipo }, caja));
      return this.cajas.length - 1;
    }
    // Primera candidata libre dentro del límite; devuelve la candidata con su índice o null
    colocar(candidatas, { limite, tipo, obligatoria = true, nombre = '' } = {}) {
      for (const cand of candidatas) {
        if (this.libre(cand.caja, limite)) {
          this.cajas.push(Object.assign({ tipo, nombre }, cand.caja));
          return Object.assign({ indice: this.cajas.length - 1 }, cand);
        }
      }
      if (obligatoria) this.fallos.push(`${tipo}: ${nombre}`);
      return null;
    }
  }

  // ---------- SVG ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = (v) => Math.round(v * 1000) / 1000;
  const linea = (x1, y1, x2, y2, grosor, extra = '') =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#000" stroke-width="${grosor}" ${extra}/>`;
  const rect = (c, grosor, extra = '') =>
    `<rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}" fill="none" stroke="#000" stroke-width="${grosor}" ${extra}/>`;
  function texto(x, y, t, tam, { ancla = 'middle', rot = 0, peso = 400, indice = null } = {}) {
    const tr = rot ? ` transform="rotate(${rot} ${n(x)} ${n(y)})"` : '';
    const id = indice !== null ? ` data-caja="${indice}"` : '';
    return `<text x="${n(x)}" y="${n(y)}" font-size="${tam}" font-family="${FUENTE}" font-weight="${peso}" text-anchor="${ancla}"${tr}${id}>${esc(t)}</text>`;
  }

  // Coloca un texto en la primera posición libre; devuelve el SVG o '' si no cabe
  function textoRegistrado(reg, posiciones, t, tam, opciones) {
    const cands = posiciones.map(p => ({ p, caja: cajaTexto(p.x, p.y, t, tam, p.ancla || 'middle', p.rot || 0) }));
    const r = reg.colocar(cands, Object.assign({ nombre: t }, opciones));
    if (!r) return '';
    return texto(r.p.x, r.p.y, t, tam, { ancla: r.p.ancla || 'middle', rot: r.p.rot || 0, peso: opciones.peso, indice: r.indice });
  }

  // Recorta con «…» hasta que quepa en el ancho dado
  function ajustar(t, tam, ancho) {
    t = String(t ?? '');
    if (anchoTexto(t, tam) <= ancho) return t;
    while (t.length > 1 && anchoTexto(t + '…', tam) > ancho) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }

  const fmtCota = (m) => m.toFixed(2).replace('.', ',');

  function elegirEscala(ancho_m, alto_m, disponible) {
    for (const e of ESCALAS) {
      if (ancho_m * 1000 / e <= disponible.w && alto_m * 1000 / e <= disponible.h) return e;
    }
    return ESCALAS[ESCALAS.length - 1];
  }

  // ---------- Cotas en cadena ----------
  // eje 'h': cota horizontal bajo el dibujo; 'v': vertical a su derecha.
  // posiciones: coordenadas (mm) de cada línea de ejes, en orden; valores: m de cada vano.
  // origen: borde del dibujo del que salen las líneas de referencia; linea: coordenada de la línea de cota.
  function cadena(reg, { eje, posiciones, valores, origen, linea: lc, tam = 2.5, limite, nombre }) {
    const partes = [];
    const hor = eje === 'h';
    const holgura = 0.6;
    const L = (a1, b1, a2, b2, g, extra) => hor ? linea(a1, b1, a2, b2, g, extra) : linea(b1, a1, b2, a2, g, extra);
    const cajaLinea = (a1, a2, b, grosor = 0.4) => hor
      ? { x: Math.min(a1, a2), y: b - grosor / 2, w: Math.abs(a2 - a1), h: grosor }
      : { x: b - grosor / 2, y: Math.min(a1, a2), w: grosor, h: Math.abs(a2 - a1) };
    const cajaRef = (a, b1, b2) => hor
      ? { x: a - 0.2, y: Math.min(b1, b2), w: 0.4, h: Math.abs(b2 - b1) }
      : { x: Math.min(b1, b2), y: a - 0.2, w: Math.abs(b2 - b1), h: 0.4 };

    // Vanos individuales si todos caben; si no, grupos de vanos iguales ("11 × 4,00")
    const hueco = (i, j) => posiciones[j] - posiciones[i];
    let grupos = valores.map((v, i) => ({ i, j: i + 1, t: fmtCota(v) }));
    if (grupos.some(gr => anchoTexto(gr.t, tam) + 2 * holgura > hueco(gr.i, gr.j))) {
      grupos = [];
      for (let i = 0; i < valores.length;) {
        let j = i + 1;
        while (j < valores.length && Math.abs(valores[j] - valores[i]) < 1e-9) j++;
        grupos.push({ i, j, t: j - i > 1 ? `${j - i} × ${fmtCota(valores[i])}` : fmtCota(valores[i]) });
        i = j;
      }
    }

    const a0 = posiciones[0], aN = posiciones[posiciones.length - 1];
    const signo = Math.sign(lc - origen);
    partes.push(L(a0, lc, aN, lc, LINEA.cota));
    reg.ocupar(cajaLinea(a0, aN, lc), 'linea_cota');

    // Líneas de referencia en los extremos de cada grupo; marcas cortas en los ejes intermedios
    const extremos = new Set([0, ...grupos.map(gr => gr.j)]);
    posiciones.forEach((a, k) => {
      if (extremos.has(k)) {
        const b1 = origen + signo * 1.5, b2 = lc + signo * 1.5;
        partes.push(L(a, b1, a, b2, LINEA.referencia));
        reg.ocupar(cajaRef(a, b1, b2), 'referencia');
        partes.push(L(a - 1, lc + signo, a + 1, lc - signo, LINEA.contorno)); // trazo oblicuo
      } else {
        partes.push(L(a, lc - 0.8, a, lc + 0.8, LINEA.cota));
        reg.ocupar(cajaRef(a, lc - 0.8, lc + 0.8), 'marca');
      }
    });

    // Texto sobre la línea (hacia el dibujo), centrado en su vano; si no cabe, fuera de los extremos
    const sep = 1.2 + DESC * tam;
    for (const gr of grupos) {
      const medio = (posiciones[gr.i] + posiciones[gr.j]) / 2;
      const w = anchoTexto(gr.t, tam);
      const pos = hor
        ? [{ x: medio, y: lc - sep },
           { x: aN + 2 + w / 2, y: lc + tam * 0.35 },
           { x: a0 - 2 - w / 2, y: lc + tam * 0.35 }]
        : [{ x: lc - sep, y: medio, rot: -90 },
           { x: lc + tam * 0.35, y: aN + 2 + w / 2, rot: -90 },
           { x: lc + tam * 0.35, y: a0 - 2 - w / 2, rot: -90 }];
      // La primera posición exige caber entre las líneas de referencia del grupo
      if (w + 2 * holgura > hueco(gr.i, gr.j)) pos.shift();
      partes.push(textoRegistrado(reg, pos, gr.t, tam, { limite, tipo: 'cota', nombre: `${nombre} ${gr.t}` }));
    }
    return partes.join('');
  }

  // ---------- Burbujas de ejes ----------
  // Etiquetas de ejes: siempre el primero y el último; del resto, uno de cada `paso`
  // (el menor que deja sitio), contando desde el primero; el registro descarta los que chocan.
  function burbujas(reg, { eje, posiciones, etiquetas, borde, limite, r = 3, distancia = 6 }) {
    const partes = [];
    const hor = eje === 'h';                          // números arriba, en horizontal
    const centro = borde - distancia - r;             // arriba del dibujo (h) o a su izquierda (v)
    const minimo = 2 * r + 1;
    const hueco = posiciones.length > 1 ? Math.abs(posiciones[1] - posiciones[0]) : Infinity;
    const paso = [1, 2, 5, 10, 20, 50].find(p => p * hueco >= minimo) || 100;
    const orden = [...new Set([0, posiciones.length - 1])];
    for (let k = 1; k < posiciones.length - 1; k++) if (k % paso === 0) orden.push(k);
    for (let k = 1; k < posiciones.length - 1; k++) if (!orden.includes(k)) orden.push(k); // sin etiqueta: trazo corto
    const conEtiqueta = new Set(orden.filter(k => k === 0 || k === posiciones.length - 1
      || k % paso === 0));
    const tam = 3;

    for (const [o, k] of orden.entries()) {
      const a = posiciones[k];
      const cx = hor ? a : centro, cy = hor ? centro : a;
      const caja = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
      const res = conEtiqueta.has(k)
        ? reg.colocar([{ caja }], { limite, tipo: 'eje', nombre: etiquetas[k], obligatoria: k === 0 || k === posiciones.length - 1 })
        : null;
      // Línea de eje: hasta la burbuja si la hay; si no, un trazo corto
      const hasta = res ? distancia : 2;
      const [x1, y1, x2, y2] = hor ? [a, borde, a, borde - hasta] : [borde, a, borde - hasta, a];
      partes.push(linea(x1, y1, x2, y2, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'));
      reg.ocupar(hor ? { x: a - 0.2, y: borde - hasta, w: 0.4, h: hasta } : { x: borde - hasta, y: a - 0.2, w: hasta, h: 0.4 }, 'eje_linea');
      if (!res) continue;
      partes.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="#fff" stroke="#000" stroke-width="${LINEA.cota}" data-caja="${res.indice}"/>`);
      partes.push(texto(cx, cy + tam * 0.36, etiquetas[k], tam));
    }
    return partes.join('');
  }

  // ---------- Escala gráfica ----------
  function escalaGrafica(reg, x, y, escala, limite) {
    const k = 1000 / escala;
    const paso = [0.5, 1, 2, 5, 10, 20, 25, 50, 100].find(p => 4 * p * k >= 30) || 100;
    const w = paso * k, alto = 1.5, partes = [];
    for (let i = 0; i < 4; i++) {
      partes.push(`<rect x="${n(x + i * w)}" y="${n(y)}" width="${n(w)}" height="${alto}" fill="${i % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width="0.18"/>`);
    }
    reg.ocupar({ x, y, w: 4 * w, h: alto }, 'escala_grafica');
    for (let i = 0; i <= 4; i++) {
      const t = String(i * paso).replace('.', ',') + (i === 4 ? ' m' : '');
      partes.push(textoRegistrado(reg, [{ x: x + i * w, y: y + alto + 3 }], t, 2, { limite, tipo: 'escala', ancla: 'middle' }));
    }
    return partes.join('');
  }

  // ---------- Cajetín 180 × 50 ----------
  // celdas: [{ x, y, w, h (relativos al cajetín), etiqueta, valor, tam, peso }]
  function cajetin(reg, celdas) {
    const partes = [rect(CAJETIN, LINEA.marco)];
    for (const c of celdas) {
      const cel = { x: CAJETIN.x + c.x, y: CAJETIN.y + c.y, w: c.w, h: c.h };
      partes.push(rect(cel, LINEA.cajetin));
      const pad = 1.2;
      const interior = { x: cel.x + pad, y: cel.y + 0.6, w: cel.w - 2 * pad, h: cel.h - 1.2 };
      partes.push(textoRegistrado(reg, [{ x: interior.x, y: cel.y + 0.6 + ASC * 1.8, ancla: 'start' }],
        c.etiqueta, 1.8, { limite: interior, tipo: 'cajetin', ancla: 'start' }));
      const tam = c.tam || 3;
      const valor = ajustar(c.valor, tam, interior.w);
      partes.push(textoRegistrado(reg, [{ x: interior.x, y: cel.y + cel.h - 1 - DESC * tam, ancla: 'start' }],
        valor, tam, { limite: interior, tipo: 'cajetin', peso: c.peso }));
    }
    return partes.join('');
  }

  const API = {
    A3, MARCO, CAJETIN, LEYENDA, DIBUJO, ESCALAS, LINEA, FUENTE, ASC, DESC,
    anchoTexto, cajaTexto, solapan, dentro, Registro,
    esc, linea, rect, texto, textoRegistrado, ajustar, fmtCota, elegirEscala,
    cadena, burbujas, escalaGrafica, cajetin
  };
  raiz.HOJA = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
