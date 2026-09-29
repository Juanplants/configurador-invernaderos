// ============================================================
// Hoja A3 de alzado lateral
// ============================================================
// PLANOS_A3.alzadoLateral({ g, modelo, empresa, proyecto, fecha,
//                           ventana: { lineas }, lateral: { alto } | null })
// → { svg, viewBox, escala, cajas, fallos, dibujo }
// Vista del lado largo: pilares en cada pórtico, canal, línea de cumbrera,
// ventana cenital a lo largo de la cumbrera (long_ventana_cenital del motor:
// largo menos un tramo en cada extremo) y ventana lateral si la hay.

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const { DIBUJO, LINEA } = H;

  const BANDA = { arriba: 24, izquierda: 26, abajo: 22, derecha: 12, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;
  const SUELO_EXTRA = 4;

  function alzadoLateral(datos) {
    return H.mejorEscala((e) => dibujarLateral(datos, e));
  }

  function dibujarLateral({ g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', numero = '03', ventana = null, lateral = null }, escala) {
    const reg = new H.Registro();
    const partes = [H.fondo()];
    const hc = g.altura_canal, hm = g.altura_cumbrera;

    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const k = 1000 / escala;
    if (g.largo * k + 2 * SUELO_EXTRA > disp.w || hm * k + 3 > disp.h) return { cabe: false, fallos: [], escala, dibujo: {} };
    const Wp = g.largo * k, Hp = hm * k;
    const x0 = disp.x + (disp.w - Wp) / 2, xN = x0 + Wp;
    const ySuelo = disp.y + (disp.h + Hp) / 2;
    const yCanal = ySuelo - hc * k, yCumbrera = ySuelo - hm * k;
    const xs = Array.from({ length: g.porticos }, (_, i) => x0 + i * g.sep_porticos * k);

    // --- Dibujo ---
    const dib = [];
    dib.push(H.linea(x0 - SUELO_EXTRA, ySuelo, xN + SUELO_EXTRA, ySuelo, LINEA.contorno));
    for (let x = x0 - SUELO_EXTRA + 1; x < xN + SUELO_EXTRA - 1.5; x += 2.5) dib.push(H.linea(x, ySuelo + 0.2, x - 1.5, ySuelo + 1.7, LINEA.referencia));
    // Cubierta vista de lado: de canal a cumbrera, cerrada en los extremos
    dib.push(`<rect x="${x0}" y="${yCumbrera}" width="${Wp}" height="${yCanal - yCumbrera}" fill="#f4f4f4" stroke="#000" stroke-width="${LINEA.contorno}"/>`);
    dib.push(H.linea(x0, yCanal, xN, yCanal, LINEA.canal));
    const anchoPilar = Math.max(0.4, 0.12 * k);
    for (const x of xs) dib.push(`<rect x="${x - anchoPilar / 2}" y="${yCanal}" width="${anchoPilar}" height="${ySuelo - yCanal}" fill="#000"/>`);

    // Ventana lateral: banda bajo el canal (posición orientativa)
    const alto = lateral && lateral.alto ? Math.min(lateral.alto, hc) : 0;
    let puntoLateral = null;
    if (alto) {
      const yb = yCanal + alto * k;
      dib.push(`<rect x="${x0}" y="${yCanal}" width="${Wp}" height="${yb - yCanal}" fill="none" stroke="#000" stroke-width="0.35" stroke-dasharray="2 1"/>`);
      dib.push(H.linea(x0, (yCanal + yb) / 2, xN, (yCanal + yb) / 2, LINEA.referencia, 'stroke-dasharray="0.6 1.2"'));
      puntoLateral = [x0 + Math.min(g.sep_porticos * k, Wp) / 2, (yCanal + yb) / 2];
    }
    // Ventana cenital a lo largo de la cumbrera
    const lineas = ventana && ventana.lineas ? ventana.lineas : 0;
    const puntoCenital = [x0 + Wp / 2, yCumbrera];
    let tieneCenital = false;
    if (lineas && g.long_ventana_cenital > 0) {
      tieneCenital = true;
      const xa = x0 + g.sep_porticos * k, xb = xN - g.sep_porticos * k;
      dib.push(H.linea(xa, yCumbrera, xb, yCumbrera, 0.9));
      puntoCenital[0] = xb - Math.min(g.sep_porticos * k, xb - xa) / 2;
    }
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    const huella = { x: x0 - SUELO_EXTRA, y: yCumbrera - 0.5, w: Wp + 2 * SUELO_EXTRA, h: ySuelo + 1.8 - (yCumbrera - 0.5) };
    reg.ocupar(huella, 'dibujo');

    // --- Ejes: números en los pórticos ---
    partes.push(H.burbujas(reg, { eje: 'h', posiciones: xs, etiquetas: xs.map((_, i) => String(i + 1)), borde: huella.y, limite: DIBUJO }));

    // --- Cotas ---
    const abajo = huella.y + huella.h;
    partes.push(H.cadena(reg, { eje: 'h', posiciones: [xs[0], xs[xs.length - 1]], valores: [g.largo], origen: abajo, linea: abajo + COTA_2, limite: DIBUJO, nombre: 'largo total' }));
    if (xs.length > 2) partes.push(H.cadena(reg, { eje: 'h', posiciones: xs, valores: xs.slice(1).map(() => g.sep_porticos), origen: abajo, linea: abajo + COTA_1, limite: DIBUJO, nombre: 'pórticos' }));
    const izq = x0 - SUELO_EXTRA;
    partes.push(H.cadena(reg, { eje: 'v', posiciones: [yCumbrera, ySuelo], valores: [hm], origen: izq, linea: izq - COTA_2, limite: DIBUJO, nombre: 'altura a cumbrera total' }));
    partes.push(H.cadena(reg, { eje: 'v', posiciones: [yCumbrera, yCanal, ySuelo], valores: [g.flecha, hc], origen: izq, linea: izq - COTA_1, limite: DIBUJO, nombre: 'canal y flecha' }));

    // --- Rótulos: opcionales aquí (en planos muy largos las burbujas no dejan
    //     paso a la línea de referencia); el dato completo va siempre en las notas ---
    const tipoCenital = lineas >= 2 ? 'mariposa' : 'de una hoja';
    const t = !lineas ? 'Techo cerrado (sin ventana cenital)' : `Ventana cenital ${tipoCenital}`;
    partes.push(H.rotulo(reg, { px: puntoCenital[0], py: puntoCenital[1], texto: t, largo: xN - puntoCenital[0] + 6, arriba: huella.y, limite: DIBUJO, nombre: 'ventana cenital', obligatoria: false }));
    if (alto) {
      partes.push(H.rotulo(reg, { px: puntoLateral[0], py: puntoLateral[1], texto: 'Ventana lateral', largo: xN - puntoLateral[0] + 6, arriba: huella.y, limite: DIBUJO, nombre: 'ventana lateral', obligatoria: false }));
    }

    const notas = ['Cotas en metros. Alturas desde el suelo terminado.'];
    notas.push(tieneCenital
      ? `Ventana cenital ${tipoCenital}: ${H.fmtCota(g.long_ventana_cenital)} m por línea, del 2.º al penúltimo pórtico.`
      : 'Techo cerrado: sin ventana cenital.');
    if (alto) notas.push(`Ventana lateral de ${H.fmtCota(alto)} m de alto a lo largo del lateral (posición orientativa).`);
    partes.push(H.hojaBase(reg, {
      escala, g, modelo, empresa, proyecto, fecha, notas,
      titulo: 'ALZADO LATERAL', numero,
      simbolos: [
        [`<rect x="-0.5" y="-1" width="1" height="2" fill="#000"/>`, 'Pilar'],
        [H.linea(-4, 0, 4, 0, LINEA.canal), 'Canal'],
        [`<rect x="-4" y="-1" width="8" height="2" fill="#f4f4f4" stroke="#000" stroke-width="${LINEA.contorno}"/>`, 'Cubierta'],
        [H.linea(-4, 0, 4, 0, 0.9), 'Ventana cenital'],
        [`<rect x="-4" y="-1" width="8" height="2" fill="none" stroke="#000" stroke-width="0.35" stroke-dasharray="2 1"/>`, 'Ventana lateral'],
        [H.linea(-4, 0, 4, 0, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'), 'Eje']
      ]
    }));

    return {
      svg: partes.join(''), viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos, cabe: true,
      dibujo: { x: x0, y: yCumbrera, w: Wp, h: Hp, disponible: disp }
    };
  }

  const API = { alzadoLateral, dibujarLateral };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
