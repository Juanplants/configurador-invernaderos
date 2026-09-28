// ============================================================
// Hoja de planta general (A3)
// ============================================================
// const h = PLANOS_A3.planta({ g, modelo, empresa, proyecto, fecha, numero, puertas, orientacion })
//   g: geometría del motor (MOTOR.calcular(...).geometria)
//   proyecto: { cliente, ubicacion, codigo }
//   puertas: { cantidad, ancho, alto } (m; del catálogo) — opcional
//   orientacion: azimut del eje largo en grados desde el norte (horario) — opcional;
//                si se da, se dibuja el norte (gira con la planta)
// → { svg, viewBox, escala, cajas, fallos, dibujo, cabe }
//   El lado largo va siempre en horizontal; la escala es la mayor con la que
//   caben el dibujo, sus cotas, ejes y rótulos (HOJA.mejorEscala).
//   cajas: todo lo apuntado en el registro (textos, burbujas, líneas de cota)
//   fallos: textos obligatorios que no han cabido (debe quedar vacío)

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const { DIBUJO, LINEA } = H;

  // Bandas alrededor del dibujo: burbujas arriba e izquierda; dos cotas abajo y a la derecha
  const BANDA = { arriba: 16, izquierda: 16, abajo: 22, derecha: 22, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;

  const letra = (i) => {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };

  function planta(datos) {
    return H.mejorEscala((e) => dibujarPlanta(datos, e));
  }

  function dibujarPlanta({ g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', numero = '01', puertas = null, orientacion }, escala) {
    const reg = new H.Registro();
    const partes = [];

    // --- Orientación y posición del dibujo: el lado largo en horizontal ---
    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const largoEnX = g.largo >= g.ancho_total;
    const k = 1000 / escala;                      // mm de papel por metro
    const W = (largoEnX ? g.largo : g.ancho_total) * k;
    const Hh = (largoEnX ? g.ancho_total : g.largo) * k;
    const disponible = { x: disp.x, y: disp.y, w: disp.w, h: disp.h };
    if (W > disp.w || Hh > disp.h) return { cabe: false, fallos: [], escala, dibujo: { w: W, h: Hh, disponible, largoEnX } };
    const x0 = disp.x + (disp.w - W) / 2, y0 = disp.y + (disp.h - Hh) / 2;
    // a: metros a lo largo (pórticos); b: metros a lo ancho (líneas de pilares)
    const pt = (a, b) => largoEnX ? [x0 + a * k, y0 + b * k] : [x0 + b * k, y0 + a * k];
    const seg = (a1, b1, a2, b2, grosor, extra) => H.linea(...pt(a1, b1), ...pt(a2, b2), grosor, extra);
    const P = Array.from({ length: g.porticos }, (_, i) => i * g.sep_porticos);
    const Q = Array.from({ length: g.naves + 1 }, (_, j) => j * g.ancho_nave);
    const L = g.largo, A = g.ancho_total;

    partes.push(H.fondo());

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
    // Puertas: hoja corredera por fuera del hastial (a = 0 frontal, a = L trasero)
    const listaPuertas = H.puertasEnHastiales(g, modelo, puertas);
    const fondoPuerta = Math.max(1, 0.3 * k);
    for (const p of listaPuertas) {
      const a = p.hastial ? L : 0, sale = p.hastial ? 1 : -1;
      const [x1, y1] = pt(a, p.centro - p.ancho / 2), [x2, y2] = pt(a + sale * fondoPuerta / k, p.centro + p.ancho / 2);
      dib.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="#fff" stroke="#000" stroke-width="0.35" data-puerta="${p.hastial}-${p.nave}"/>`);
      dib.push(seg(a + sale * fondoPuerta / k / 2, p.centro - p.ancho / 2, a + sale * fondoPuerta / k / 2, p.centro + p.ancho / 2, 0.18));
    }
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    // Huella: dibujo, pilares y puertas (que asoman por fuera de los hastiales)
    const asoma = listaPuertas.length ? fondoPuerta : 0;
    const huella = largoEnX
      ? { x: x0 - Math.max(lado / 2, asoma), y: y0 - lado / 2, w: W + Math.max(lado / 2, asoma) * 2, h: Hh + lado }
      : { x: x0 - lado / 2, y: y0 - Math.max(lado / 2, asoma), w: W + lado, h: Hh + Math.max(lado / 2, asoma) * 2 };
    reg.ocupar(huella, 'dibujo');

    // --- Ejes: números en los pórticos, letras en las líneas de pilares ---
    // Horizontal → burbujas arriba; vertical → a la izquierda
    const enPapel = (metros, horizontal) => metros.map(m => (horizontal ? x0 : y0) + m * k);
    const ejesP = { posiciones: enPapel(P, largoEnX), etiquetas: P.map((_, i) => String(i + 1)) };
    const ejesQ = { posiciones: enPapel(Q, !largoEnX), etiquetas: Q.map((_, j) => letra(j)) };
    const [ejesH, ejesV] = largoEnX ? [ejesP, ejesQ] : [ejesQ, ejesP];
    partes.push(H.burbujas(reg, Object.assign({ eje: 'h', borde: huella.y, limite: DIBUJO }, ejesH)));
    partes.push(H.burbujas(reg, Object.assign({ eje: 'v', borde: huella.x, limite: DIBUJO }, ejesV)));

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
    cotas('h', cotaH[0], cotaH[1], cotaH[2], huella.y + huella.h, cotaH[3]);
    cotas('v', cotaV[0], cotaV[1], cotaV[2], huella.x + huella.w, cotaV[3]);

    // --- Leyenda, escala gráfica y cajetín ---
    partes.push(H.hojaBase(reg, {
      escala, titulo: 'PLANTA GENERAL', numero, g, modelo, empresa, proyecto, fecha,
      simbolos: [
        [`<rect x="-0.6" y="-0.6" width="1.2" height="1.2" fill="#000"/>`, 'Pilar'],
        [`<rect x="-0.5" y="-0.5" width="1" height="1" fill="#fff" stroke="#000" stroke-width="0.18"/>`, 'Pilar de hastial'],
        [H.linea(-4, 0, 4, 0, LINEA.canal), 'Canal'],
        [H.linea(-4, 0, 4, 0, LINEA.cumbrera, 'stroke-dasharray="3 1.5"'), 'Cumbrera'],
        [H.linea(-4, 0, 4, 0, LINEA.portico, 'stroke="#555"'), 'Pórtico (arco)'],
        [H.linea(-4, 0, 4, 0, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'), 'Eje'],
        ...(listaPuertas.length ? [[`<rect x="-3" y="-0.6" width="6" height="1.2" fill="#fff" stroke="#000" stroke-width="0.35"/>`, 'Puerta corredera']] : [])
      ],
      notas: ['Cotas en metros, entre ejes de pilares.'].concat(notaPuertas(listaPuertas, g)),
      norte: orientacion === undefined || orientacion === null ? null : (largoEnX ? 90 : 180) - orientacion
    }));

    return {
      svg: partes.join(''),
      viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos, cabe: true,
      dibujo: { x: x0, y: y0, w: W, h: Hh, disponible, largoEnX, puertas: listaPuertas.length }
    };
  }

  function notaPuertas(lista, g) {
    if (!lista.length) return [];
    const p = lista[0];
    const traseras = lista.filter(x => x.hastial).length;
    const donde = traseras ? `${lista.length - traseras} en el frontal y ${traseras} en el trasero` : 'en el frontal';
    return [`Puertas: ${lista.length} de ${H.fmtCota(p.ancho)} × ${H.fmtCota(p.alto)} m, ${donde}${p.entrePilares ? '' : ' (coinciden con pilares de hastial)'}.`];
  }

  const API = { planta, dibujarPlanta, notaPuertas, letra, BANDA };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
