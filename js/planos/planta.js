// ============================================================
// Hoja de planta general (A3)
// ============================================================
// const h = PLANOS_A3.planta({ g, modelo, empresa, proyecto, fecha, numero })
//   g: geometría del motor (MOTOR.calcular(...).geometria)
//   proyecto: { cliente, ubicacion, codigo }
// → { svg, viewBox, escala, cajas, fallos, dibujo }
//   cajas: todo lo apuntado en el registro (textos, burbujas, líneas de cota)
//   fallos: textos obligatorios que no han cabido (debe quedar vacío)

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const { MARCO, CAJETIN, LEYENDA, DIBUJO, LINEA } = H;

  // Bandas alrededor del dibujo: burbujas arriba e izquierda; dos cotas abajo y a la derecha
  const BANDA = { arriba: 16, izquierda: 16, abajo: 22, derecha: 22, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;

  const letra = (i) => {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };

  function planta({ g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', numero = '01' }) {
    const reg = new H.Registro();
    const partes = [];

    // --- Escala, orientación y posición del dibujo ---
    // El largo va en horizontal salvo que en vertical quepa a una escala mayor
    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const eHoriz = H.elegirEscala(g.largo, g.ancho_total, disp);
    const eVert = H.elegirEscala(g.ancho_total, g.largo, disp);
    const largoEnX = eHoriz <= eVert;
    const escala = largoEnX ? eHoriz : eVert;
    const k = 1000 / escala;                      // mm de papel por metro
    const W = (largoEnX ? g.largo : g.ancho_total) * k;
    const Hh = (largoEnX ? g.ancho_total : g.largo) * k;
    const x0 = disp.x + (disp.w - W) / 2, y0 = disp.y + (disp.h - Hh) / 2;
    // a: metros a lo largo (pórticos); b: metros a lo ancho (líneas de pilares)
    const pt = (a, b) => largoEnX ? [x0 + a * k, y0 + b * k] : [x0 + b * k, y0 + a * k];
    const seg = (a1, b1, a2, b2, grosor, extra) => H.linea(...pt(a1, b1), ...pt(a2, b2), grosor, extra);
    const P = Array.from({ length: g.porticos }, (_, i) => i * g.sep_porticos);
    const Q = Array.from({ length: g.naves + 1 }, (_, j) => j * g.ancho_nave);
    const L = g.largo, A = g.ancho_total;

    // --- Marco y zonas ---
    partes.push(`<rect x="0" y="0" width="${H.A3.w}" height="${H.A3.h}" fill="#fff"/>`);
    partes.push(H.rect(MARCO, LINEA.marco));
    partes.push(H.linea(LEYENDA.x, LEYENDA.y, CAJETIN.x, LEYENDA.y, LINEA.cajetin));

    // --- Dibujo ---
    const lado = Math.max(0.9, 0.12 * k);         // pilar: 12 cm reales, mínimo 0,9 mm
    const cuadro = (a, b, t, estilo) => {
      const [x, y] = pt(a, b);
      return `<rect x="${x - t / 2}" y="${y - t / 2}" width="${t}" height="${t}" ${estilo}/>`;
    };
    const dib = [];
    for (let j = 0; j < g.naves; j++) {           // cumbreras
      const bm = (j + 0.5) * g.ancho_nave;
      dib.push(seg(0, bm, L, bm, LINEA.cumbrera, 'stroke-dasharray="3 1.5"'));
    }
    for (const a of P) dib.push(seg(a, 0, a, A, LINEA.portico, 'stroke="#555"'));
    for (const b of Q) dib.push(seg(0, b, L, b, LINEA.canal));
    dib.push(H.rect({ x: x0, y: y0, w: W, h: Hh }, LINEA.contorno));
    for (const a of P) for (const b of Q) dib.push(cuadro(a, b, lado, 'fill="#000"'));
    // Pilares de hastial: intermedios en los dos frontales, repartidos por nave
    const porNave = Math.max(Math.round(g.ancho_nave / (modelo.sep_pilares_hastial || g.ancho_nave)) - 1, 0);
    for (const a of [0, L]) {
      for (let j = 0; j < g.naves; j++) {
        for (let q = 1; q <= porNave; q++) {
          dib.push(cuadro(a, j * g.ancho_nave + q * g.ancho_nave / (porNave + 1), lado * 0.8, 'fill="#fff" stroke="#000" stroke-width="0.18"'));
        }
      }
    }
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    reg.ocupar({ x: x0 - lado / 2, y: y0 - lado / 2, w: W + lado, h: Hh + lado }, 'dibujo');

    // --- Ejes: números en los pórticos, letras en las líneas de pilares ---
    // Horizontal → burbujas arriba; vertical → a la izquierda
    const enPapel = (metros, horizontal) => metros.map(m => (horizontal ? x0 : y0) + m * k);
    const ejesP = { posiciones: enPapel(P, largoEnX), etiquetas: P.map((_, i) => String(i + 1)) };
    const ejesQ = { posiciones: enPapel(Q, !largoEnX), etiquetas: Q.map((_, j) => letra(j)) };
    const [ejesH, ejesV] = largoEnX ? [ejesP, ejesQ] : [ejesQ, ejesP];
    partes.push(H.burbujas(reg, Object.assign({ eje: 'h', borde: y0, limite: DIBUJO }, ejesH)));
    partes.push(H.burbujas(reg, Object.assign({ eje: 'v', borde: x0, limite: DIBUJO }, ejesV)));

    // --- Cotas: abajo la dirección horizontal, a la derecha la vertical; el total
    //     por fuera y primero (así la cadena no pisa sus líneas de referencia).
    //     Con un solo vano la cadena repetiría el total y se omite ---
    const cotas = (eje, pos, vano, total, origen, nombre) => {
      partes.push(H.cadena(reg, { eje, posiciones: [pos[0], pos[pos.length - 1]], valores: [total], origen, linea: origen + COTA_2, limite: DIBUJO, nombre: `${nombre} total` }));
      if (pos.length > 2) partes.push(H.cadena(reg, { eje, posiciones: pos, valores: pos.slice(1).map(() => vano), origen, linea: origen + COTA_1, limite: DIBUJO, nombre }));
    };
    const cotaP = [ejesP.posiciones, g.sep_porticos, L, 'pórticos'];
    const cotaQ = [ejesQ.posiciones, g.ancho_nave, A, 'naves'];
    const [cotaH, cotaV] = largoEnX ? [cotaP, cotaQ] : [cotaQ, cotaP];
    cotas('h', cotaH[0], cotaH[1], cotaH[2], y0 + Hh, cotaH[3]);
    cotas('v', cotaV[0], cotaV[1], cotaV[2], x0 + W, cotaV[3]);

    // --- Leyenda, escala gráfica ---
    const LZ = { x: LEYENDA.x + 2, y: LEYENDA.y + 1, w: LEYENDA.w - 4, h: LEYENDA.h - 2 };
    partes.push(H.textoRegistrado(reg, [{ x: LZ.x + 1, y: LZ.y + 4, ancla: 'start' }], 'LEYENDA', 2.5, { limite: LZ, tipo: 'leyenda', peso: 700 }));
    const simbolos = [
      [`<rect x="-0.6" y="-0.6" width="1.2" height="1.2" fill="#000"/>`, 'Pilar'],
      [`<rect x="-0.5" y="-0.5" width="1" height="1" fill="#fff" stroke="#000" stroke-width="0.18"/>`, 'Pilar de hastial'],
      [H.linea(-4, 0, 4, 0, LINEA.canal), 'Canal'],
      [H.linea(-4, 0, 4, 0, LINEA.cumbrera, 'stroke-dasharray="3 1.5"'), 'Cumbrera'],
      [H.linea(-4, 0, 4, 0, LINEA.portico, 'stroke="#555"'), 'Pórtico (arco)'],
      [H.linea(-4, 0, 4, 0, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'), 'Eje']
    ];
    simbolos.forEach(([svg, t], i) => {
      const col = Math.floor(i / 3), fila = i % 3;
      const cx = LZ.x + 6 + col * 45, cy = LZ.y + 10 + fila * 6;
      partes.push(`<g transform="translate(${cx} ${cy})">${svg}</g>`);
      reg.ocupar({ x: cx - 4.2, y: cy - 1, w: 8.4, h: 2 }, 'leyenda_simbolo');
      partes.push(H.textoRegistrado(reg, [{ x: cx + 6, y: cy + 0.8, ancla: 'start' }], t, 2.2, { limite: LZ, tipo: 'leyenda' }));
    });
    const notas = [
      'Cotas en metros, entre ejes de pilares.',
      `Escala ${'1:' + escala} en formato A3 (420 × 297 mm).`
    ];
    notas.forEach((t, i) => partes.push(H.textoRegistrado(reg, [{ x: LZ.x + 1, y: LZ.y + 32 + i * 3.6, ancla: 'start' }], t, 2.2, { limite: LZ, tipo: 'leyenda' })));
    partes.push(H.textoRegistrado(reg, [{ x: LZ.x + 100, y: LZ.y + 4, ancla: 'start' }], 'ESCALA GRÁFICA', 2.5, { limite: LZ, tipo: 'leyenda', peso: 700 }));
    partes.push(H.escalaGrafica(reg, LZ.x + 100, LZ.y + 9, escala, LZ));

    // --- Cajetín ---
    const fmt = (v) => H.fmtCota(v);
    const proy = [proyecto.cliente, proyecto.codigo].filter(Boolean).join(' · ') || '—';
    partes.push(H.cajetin(reg, [
      { x: 0, y: 0, w: 100, h: 14, etiqueta: 'DISTRIBUIDOR', valor: empresa.nombre || '—', tam: 3.5, peso: 700 },
      { x: 100, y: 0, w: 80, h: 14, etiqueta: 'PLANO', valor: 'PLANTA GENERAL', tam: 4, peso: 700 },
      { x: 0, y: 14, w: 100, h: 12, etiqueta: 'CLIENTE · PROYECTO', valor: proy },
      { x: 100, y: 14, w: 40, h: 12, etiqueta: 'ESCALA', valor: '1:' + escala, tam: 3.5, peso: 700 },
      { x: 140, y: 14, w: 40, h: 12, etiqueta: 'FORMATO', valor: 'A3' },
      { x: 0, y: 26, w: 100, h: 12, etiqueta: 'UBICACIÓN', valor: proyecto.ubicacion || '—' },
      { x: 100, y: 26, w: 40, h: 12, etiqueta: 'FECHA', valor: fecha || '—' },
      { x: 140, y: 26, w: 40, h: 12, etiqueta: 'PLANO N.º', valor: numero },
      { x: 0, y: 38, w: 100, h: 12, etiqueta: 'MODELO', valor: modelo.nombre || '—' },
      { x: 100, y: 38, w: 80, h: 12, etiqueta: 'DIMENSIONES', valor: `${g.naves} × ${fmt(g.ancho_nave)} × ${fmt(g.largo)} m · ${Math.round(g.area).toLocaleString('es-ES')} m²` }
    ]));

    return {
      svg: partes.join(''),
      viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos,
      dibujo: { x: x0, y: y0, w: W, h: Hh, disponible: disp, largoEnX }
    };
  }

  const API = { planta, letra, BANDA };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
