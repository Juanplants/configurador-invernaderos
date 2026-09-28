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
  // UNE-EN ISO 5455 (1:20, 1:50, 1:100, 1:200, 1:500, 1:1000, 1:2000) más las
  // intermedias habituales en construcción (1:250, 1:300, 1:400)
  const ESCALAS = [20, 50, 100, 200, 250, 300, 400, 500, 1000, 2000];
  const NOTA_CAJETIN = 'Plano informativo de oferta. No válido para ejecución ni tramitación.';

  // Grosores de línea (mm) por elemento
  const LINEA = {
    marco: 0.7, cajetin: 0.35, contorno: 0.5, canal: 0.35, portico: 0.25,
    cumbrera: 0.18, eje: 0.13, cota: 0.18, referencia: 0.13
  };
  const FUENTE = "'Liberation Sans', Arial, Helvetica, sans-serif";

  // ---------- Juego de caracteres ----------
  // Las fuentes estándar del PDF (Helvetica) solo tienen WinAnsi (cp1252): un
  // carácter fuera de él hace que el PDF salga ilegible. Todos los textos de la
  // hoja se pasan por aquí antes de medirlos y dibujarlos.
  const EXTRA_CP1252 = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const SUSTITUTOS = { '≈': 'aprox.', '−': '-', '‐': '-', '‑': '-', '≤': '<=', '≥': '>=', '⁰': '0', '³': '3' };
  const enWinAnsi = (c) => { const k = c.codePointAt(0); return (k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || EXTRA_CP1252.includes(c); };
  const aWinAnsi = (t) => [...String(t ?? '').normalize('NFC')].map(c => (enWinAnsi(c) ? c : (SUSTITUTOS[c] ?? '?'))).join('');

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

  // Caja de un texto; ancla 'start' | 'middle' | 'end'; rot en grados (-90: se lee de abajo arriba)
  function cajaTexto(x, y, texto, tam, ancla = 'middle', rot = 0) {
    const w = anchoTexto(texto, tam);
    const d = ancla === 'start' ? 0 : ancla === 'end' ? w : w / 2;
    if (rot === -90) return { x: x - ASC * tam, y: y - w + d, w: (ASC + DESC) * tam, h: w };
    if (rot) {
      // Otro ángulo (cotas alineadas con un lado oblicuo): caja que envuelve el texto girado
      const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
      const pts = [[-d, -ASC * tam], [w - d, -ASC * tam], [w - d, DESC * tam], [-d, DESC * tam]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
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
    t = aWinAnsi(t);
    const tr = rot ? ` transform="rotate(${rot} ${n(x)} ${n(y)})"` : '';
    const id = indice !== null ? ` data-caja="${indice}"` : '';
    return `<text x="${n(x)}" y="${n(y)}" font-size="${tam}" font-family="${FUENTE}" font-weight="${peso}" text-anchor="${ancla}"${tr}${id}>${esc(t)}</text>`;
  }

  // Coloca un texto en la primera posición libre; devuelve el SVG o '' si no cabe
  function textoRegistrado(reg, posiciones, t, tam, opciones) {
    t = aWinAnsi(t);
    const cands = posiciones.map(p => ({ p, caja: cajaTexto(p.x, p.y, t, tam, p.ancla || 'middle', p.rot || 0) }));
    const r = reg.colocar(cands, Object.assign({ nombre: t }, opciones));
    if (!r) return '';
    return texto(r.p.x, r.p.y, t, tam, { ancla: r.p.ancla || 'middle', rot: r.p.rot || 0, peso: opciones.peso, indice: r.indice });
  }

  // Recorta con «…» hasta que quepa en el ancho dado
  function ajustar(t, tam, ancho) {
    t = aWinAnsi(t);
    if (anchoTexto(t, tam) <= ancho) return t;
    while (t.length > 1 && anchoTexto(t + '…', tam) > ancho) t = t.slice(0, -1);
    return t.trimEnd() + '…';
  }

  const fmtCota = (m) => m.toFixed(2).replace('.', ',');

  // La mayor escala con la que la hoja cabe entera: dibujar(E) debe devolver
  // { cabe, fallos, … }; se acepta la primera sin fallos (cotas, ejes y rótulos
  // obligatorios colocados). Si ninguna vale, la última intentada.
  function mejorEscala(dibujar, escalas = ESCALAS) {
    let ultima = null;
    for (const e of escalas) {
      const h = dibujar(e);
      if (h.cabe && !h.fallos.length) return h;
      if (h.cabe || !ultima) ultima = h;
    }
    return ultima;
  }
  const ocupacion = (d) => Math.max(d.w / d.disponible.w, d.h / d.disponible.h);

  // Puertas en los hastiales: primero una por nave en el frontal (hastial 0),
  // el resto en el trasero. Cada una en el hueco entre pilares de hastial más
  // cercano al centro de la nave en el que quepa; si no cabe en ninguno, centrada.
  function puertasEnHastiales(g, modelo, puertas) {
    if (!puertas || !puertas.cantidad || !(puertas.ancho > 0) || !(puertas.alto > 0)) return [];
    const w = g.ancho_nave;
    const porNave = Math.max(Math.round(w / (modelo.sep_pilares_hastial || w)) - 1, 0);
    const marcas = [0, ...Array.from({ length: porNave }, (_, q) => (q + 1) * w / (porNave + 1)), w];
    const huecos = marcas.slice(1).map((b, i) => ({ c: (marcas[i] + b) / 2, luz: b - marcas[i] }))
      .filter(h => h.luz >= puertas.ancho + 0.2 - 1e-9)  // holgura de 10 cm a cada lado
      .sort((a, b) => Math.abs(a.c - w / 2) - Math.abs(b.c - w / 2));
    const centro = huecos.length ? huecos[0].c : w / 2;
    const lista = [];
    for (let i = 0; i < Math.min(puertas.cantidad, 2 * g.naves); i++) {
      const hastial = i < g.naves ? 0 : 1, nave = i % g.naves;
      lista.push({ hastial, nave, centro: nave * w + centro, ancho: puertas.ancho, alto: puertas.alto, entrePilares: huecos.length > 0 });
    }
    return lista;
  }

  // ---------- Cotas en cadena ----------
  // eje 'h': cota horizontal bajo el dibujo; 'v': vertical a su derecha.
  // posiciones: coordenadas (mm) de cada línea de ejes, en orden; valores: m de cada vano.
  // origen: borde del dibujo del que salen las líneas de referencia; linea: coordenada de la línea de cota.
  // textos: rótulo de cada vano en lugar del valor (p. ej. un tramo interrumpido); no se agrupan
  function cadena(reg, { eje, posiciones, valores, textos, origen, linea: lc, tam = 2.5, limite, nombre }) {
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
    let grupos = valores.map((v, i) => ({ i, j: i + 1, t: textos ? textos[i] : fmtCota(v) }));
    if (!textos && grupos.some(gr => anchoTexto(gr.t, tam) + 2 * holgura > hueco(gr.i, gr.j))) {
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
      // Fuera de los extremos, primero por el lado más cercano al vano
      if (medio < (a0 + aN) / 2) [pos[1], pos[2]] = [pos[2], pos[1]];
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
      const tam = c.tam || 3;
      const valor = ajustar(c.valor, tam, interior.w);
      if (c.etiqueta) {
        partes.push(textoRegistrado(reg, [{ x: interior.x, y: cel.y + 0.6 + ASC * 1.8, ancla: 'start' }],
          c.etiqueta, 1.8, { limite: interior, tipo: 'cajetin', ancla: 'start' }));
        partes.push(textoRegistrado(reg, [{ x: interior.x, y: cel.y + cel.h - 1 - DESC * tam, ancla: 'start' }],
          valor, tam, { limite: interior, tipo: 'cajetin', peso: c.peso }));
      } else {
        const y = cel.y + cel.h / 2 + (ASC - DESC) * tam / 2;
        partes.push(textoRegistrado(reg, [{ x: cel.x + cel.w / 2, y, ancla: 'middle' }], valor, tam, { limite: interior, tipo: 'cajetin', peso: c.peso }));
      }
    }
    return partes.join('');
  }

  // ---------- Fondo, leyenda y cajetín comunes a todas las hojas ----------
  function fondo() {
    return `<rect x="0" y="0" width="${A3.w}" height="${A3.h}" fill="#fff"/>`
      + rect(MARCO, LINEA.marco)
      + linea(LEYENDA.x, LEYENDA.y, CAJETIN.x, LEYENDA.y, LINEA.cajetin);
  }

  // simbolos: [[svg centrado en 0,0 (±4 × ±1 mm), texto]] (hasta 9, en 3 columnas);
  // notas: líneas bajo los símbolos; norte: ángulo del norte en el papel (grados
  // desde arriba, horario) o null para no dibujarlo
  function hojaBase(reg, { escala, titulo, numero, g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', simbolos = [], notas = [], norte = null }) {
    const partes = [];
    const LZ = { x: LEYENDA.x + 2, y: LEYENDA.y + 1, w: LEYENDA.w - 4, h: LEYENDA.h - 2 };
    partes.push(textoRegistrado(reg, [{ x: LZ.x + 1, y: LZ.y + 4, ancla: 'start' }], 'LEYENDA', 2.5, { limite: LZ, tipo: 'leyenda', peso: 700 }));
    simbolos.slice(0, 9).forEach(([svg, t], i) => {
      const col = Math.floor(i / 3), fila = i % 3;
      const cx = LZ.x + 6 + col * 44, cy = LZ.y + 10 + fila * 6;
      partes.push(`<g transform="translate(${cx} ${cy})">${svg}</g>`);
      reg.ocupar({ x: cx - 4.2, y: cy - 1.2, w: 8.4, h: 2.4 }, 'leyenda_simbolo');
      partes.push(textoRegistrado(reg, [{ x: cx + 6, y: cy + 0.8, ancla: 'start' }], t, 2.2, { limite: LZ, tipo: 'leyenda' }));
    });
    const lineas = notas.slice(0, 4).concat([`Escala 1:${escala} en formato A3 (420 × 297 mm).`]);
    lineas.forEach((t, i) => partes.push(textoRegistrado(reg, [{ x: LZ.x + 1, y: LZ.y + 30 + i * 3.6, ancla: 'start' }],
      ajustar(t, 2.2, LZ.w - 2), 2.2, { limite: LZ, tipo: 'leyenda' })));
    partes.push(textoRegistrado(reg, [{ x: LZ.x + 136, y: LZ.y + 4, ancla: 'start' }], 'ESCALA GRÁFICA', 2.5, { limite: LZ, tipo: 'leyenda', peso: 700 }));
    partes.push(escalaGrafica(reg, LZ.x + 136, LZ.y + 9, escala, LZ));
    if (norte !== null && norte !== undefined) {
      const cx = LZ.x + LZ.w - 9, cy = LZ.y + LZ.h - 11, r = 6;
      partes.push(`<g transform="translate(${n(cx)} ${n(cy)})"><circle r="${r}" fill="#fff" stroke="#000" stroke-width="${LINEA.cota}"/>`
        + `<g transform="rotate(${n(norte)})"><path d="M0,-5 L2.2,3 L0,1.6 L-2.2,3 Z" fill="#000"/></g></g>`);
      reg.ocupar({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, 'norte');
      const [nx, ny] = [cx + Math.sin(norte * Math.PI / 180) * (r + 2.6), cy - Math.cos(norte * Math.PI / 180) * (r + 2.6) + 1];
      partes.push(textoRegistrado(reg, [{ x: nx, y: ny }, { x: cx - r - 3, y: cy + 1 }], 'N', 2.5, { limite: LZ, tipo: 'leyenda', peso: 700 }));
    }

    const proy = [proyecto.cliente, proyecto.codigo].filter(Boolean).join(' · ') || '—';
    partes.push(cajetin(reg, [
      { x: 0, y: 0, w: 100, h: 12, etiqueta: 'DISTRIBUIDOR', valor: empresa.nombre || '—', tam: 3.5, peso: 700 },
      { x: 100, y: 0, w: 80, h: 12, etiqueta: 'PLANO', valor: titulo, tam: 4, peso: 700 },
      { x: 0, y: 12, w: 100, h: 10, etiqueta: 'CLIENTE · PROYECTO', valor: proy },
      { x: 100, y: 12, w: 40, h: 10, etiqueta: 'ESCALA', valor: '1:' + escala, tam: 3.5, peso: 700 },
      { x: 140, y: 12, w: 40, h: 10, etiqueta: 'FORMATO', valor: 'A3' },
      { x: 0, y: 22, w: 100, h: 10, etiqueta: 'UBICACIÓN', valor: proyecto.ubicacion || '—' },
      { x: 100, y: 22, w: 40, h: 10, etiqueta: 'FECHA', valor: fecha || '—' },
      { x: 140, y: 22, w: 40, h: 10, etiqueta: 'PLANO N.º', valor: numero },
      { x: 0, y: 32, w: 100, h: 10, etiqueta: 'MODELO', valor: modelo.nombre || '—' },
      { x: 100, y: 32, w: 80, h: 10, etiqueta: 'DIMENSIONES', valor: `${g.naves} × ${fmtCota(g.ancho_nave)} × ${fmtCota(g.largo)} m · ${Math.round(g.area).toLocaleString('es-ES')} m²` },
      { x: 0, y: 42, w: 180, h: 8, valor: NOTA_CAJETIN, tam: 2.4, peso: 700 }
    ]));
    return partes.join('');
  }

  // ---------- Rótulo con línea de referencia ----------
  // Desde el punto (px, py): primero en horizontal hacia la derecha o la
  // izquierda (largo mm); si no cabe, en vertical hasta encima del dibujo
  // (`arriba`: borde superior del dibujo) con el texto centrado. Devuelve '' si no cabe.
  // evitar: polígonos ([[x, y], …]) que la línea no puede cruzar; corto: primero la línea más corta
  function rotulo(reg, { px, py, texto: t, tam = 2.5, largo = 12, arriba, limite, nombre, obligatoria = true, evitar = [], corto = false }) {
    const cands = [];
    for (const lado of [1, -1]) {
      for (const extra of [0, 8, 20, 40]) {
        const fin = px + lado * (largo + extra);
        const x = fin + lado * 1;
        cands.push({ l: [px, py, fin, py], p: { x, y: py + tam * 0.35, ancla: lado > 0 ? 'start' : 'end' },
          caja: cajaTexto(x, py + tam * 0.35, t, tam, lado > 0 ? 'start' : 'end') });
      }
    }
    if (arriba !== undefined) {
      for (const e of [4, 10, 16]) {
        const fin = arriba - e;
        const y = fin - 0.8 - DESC * tam;
        cands.push({ l: [px, py, px, fin], p: { x: px, y, ancla: 'middle' }, caja: cajaTexto(px, y, t, tam, 'middle') });
      }
    }
    // La línea sale de dentro del dibujo: puede cruzar su contorno, pero no textos ni otras líneas
    const cajaL = ([x1, y1, x2, y2]) => ({ x: Math.min(x1, x2) - 0.2, y: Math.min(y1, y2) - 0.2, w: Math.abs(x2 - x1) + 0.4, h: Math.abs(y2 - y1) + 0.4 });
    let libres = cands.filter(c => reg.cajas.every(o => o.tipo === 'dibujo' || !solapan(cajaL(c.l), o))
      && evitar.every(pol => !cortaPoligono(c.l, pol)));
    if (corto) libres = libres.map((c, i) => [c, i]).sort((a, b) => (largoL(a[0].l) - largoL(b[0].l)) || a[1] - b[1]).map(x => x[0]);
    const r = reg.colocar(libres, { limite, tipo: 'rotulo', nombre: nombre || t, obligatoria });
    if (!r) return '';
    reg.ocupar(cajaL(r.l), 'referencia');
    return linea(...r.l, LINEA.referencia) + `<circle cx="${n(px)}" cy="${n(py)}" r="0.5" fill="#000"/>`
      + texto(r.p.x, r.p.y, t, tam, { ancla: r.p.ancla, indice: r.indice });
  }

  const largoL = ([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1);
  // ¿El segmento entra en el polígono o cruza su contorno?
  function cortaPoligono([x1, y1, x2, y2], pol) {
    const dentroPol = ([x, y]) => {
      let d = false;
      for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
        const [xi, yi] = pol[i], [xj, yj] = pol[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d;
      }
      return d;
    };
    const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    const A = [x1, y1], B = [x2, y2];
    if (dentroPol(A) || dentroPol(B) || dentroPol([(x1 + x2) / 2, (y1 + y2) / 2])) return true;
    return pol.some((c, i) => { const d = pol[(i + 1) % pol.length]; return o(A, B, c) * o(A, B, d) < 0 && o(c, d, A) * o(c, d, B) < 0; });
  }

  // ---------- Perfil del arco ----------
  // Parábola de luz `ancho` y flecha `flecha` (m): la misma forma con la que el
  // motor calcula la longitud de arco y el volumen. Devuelve [x, altura] desde el canal.
  function puntosArco(ancho, flecha, pasos = 40) {
    return Array.from({ length: pasos + 1 }, (_, i) => {
      const t = i / pasos;
      return [t * ancho, flecha * (1 - (2 * t - 1) ** 2)];
    });
  }
  // Punto del arco a una distancia `s` (m, medida sobre el arco) desde la cumbrera, hacia lado ±1
  function puntoDesdeCumbrera(ancho, flecha, s, lado) {
    const pasos = 400, dx = (ancho / 2) / pasos;
    const y = (x) => flecha * (1 - (2 * x / ancho - 1) ** 2);
    let x = ancho / 2, recorrido = 0;
    for (let i = 0; i < pasos && recorrido < s; i++) {
      const x2 = x + lado * dx;
      recorrido += Math.hypot(dx, y(x2) - y(x));
      x = x2;
    }
    return [x, y(x)];
  }

  const API = {
    A3, MARCO, CAJETIN, LEYENDA, DIBUJO, ESCALAS, LINEA, FUENTE, ASC, DESC,
    anchoTexto, cajaTexto, solapan, dentro, Registro,
    NOTA_CAJETIN, aWinAnsi, enWinAnsi, esc, linea, rect, texto, textoRegistrado, ajustar, fmtCota, mejorEscala, ocupacion, puertasEnHastiales,
    cadena, burbujas, escalaGrafica, cajetin, fondo, hojaBase, rotulo, cortaPoligono, puntosArco, puntoDesdeCumbrera
  };
  raiz.HOJA = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
