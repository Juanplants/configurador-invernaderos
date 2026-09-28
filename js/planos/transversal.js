// ============================================================
// Hojas A3 transversales: alzado frontal y sección transversal
// ============================================================
// PLANOS_A3.alzadoFrontal(datos) / PLANOS_A3.seccion(datos)
//   datos: { g, modelo, empresa, proyecto, fecha,
//            ventana: { lineas: 0|1|2, hoja: m, rendija: m } (solo sección),
//            puertas: { cantidad, ancho, alto } (solo alzado frontal) }
// → { svg, viewBox, escala, cajas, fallos, dibujo, cabe }
//
// Encaje: si el invernadero entero cabe a 1:300 o mayor, se dibuja completo.
// Si no, se interrumpe: las primeras naves, una interrupción y la última, a la
// mayor escala en la que quepan al menos dos, y tantas como llenen el ancho.
// La cota de la interrupción dice cuántas naves faltan y la total es la real.

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const { DIBUJO, LINEA } = H;

  const BANDA = { arriba: 24, izquierda: 26, abajo: 22, derecha: 12, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;
  const letra = (i) => {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };
  const grados = (rad) => Math.round(rad * 180 / Math.PI);

  // Apertura de la hoja cenital: 2·arcsen(rendija / (2·hoja)) (aproximación de la especificación)
  function apertura(ventana) {
    if (!ventana || !ventana.lineas || !ventana.hoja) return 0;
    return 2 * Math.asin(Math.min(ventana.rendija || ventana.hoja, ventana.hoja) / (2 * ventana.hoja));
  }

  const COMPLETO_HASTA = 300; // denominador máximo para dibujar el invernadero entero

  // Naves dibujadas: todas (m = n) o las m − 1 primeras y la última
  const navesDibujadas = (n, m) => (m >= n ? Array.from({ length: n }, (_, i) => i)
    : [...Array.from({ length: m - 1 }, (_, i) => i), n - 1]);

  function seleccionar(tipo, datos) {
    const n = datos.g.naves;
    const intento = (e, m) => dibujarTransversal(tipo, datos, e, navesDibujadas(n, m));
    const vale = (h) => h.cabe && !h.fallos.length;
    for (const e of H.ESCALAS.filter(e => e <= COMPLETO_HASTA)) {
      const h = intento(e, n);
      if (vale(h)) return h;
    }
    for (const e of H.ESCALAS) {
      for (let m = n - 1; m >= 2; m--) {
        const h = intento(e, m);
        if (vale(h)) return h;
      }
    }
    return H.mejorEscala((e) => intento(e, n)); // último recurso: entero, a la escala que quepa
  }

  function dibujarTransversal(tipo, { g, modelo = {}, empresa = {}, proyecto = {}, fecha = '', ventana = null, puertas = null }, escala, mostradas) {
    const seccion = tipo === 'seccion';
    const reg = new H.Registro();
    const partes = [H.fondo()];
    const w = g.ancho_nave, f = g.flecha, hc = g.altura_canal, hm = g.altura_cumbrera;
    const n = g.naves;

    const corte = mostradas.length < n;
    const ultima = mostradas.length - 1;          // índice (en mostradas) de la nave tras la interrupción
    const textoCorte = corte ? `${n - mostradas.length} × ${H.fmtCota(w)}` : '';
    const HUECO = corte ? Math.max(14, H.anchoTexto(textoCorte, 2.5) + 4) : 0;

    const disp = {
      x: DIBUJO.x + BANDA.izquierda + BANDA.margen,
      y: DIBUJO.y + BANDA.arriba + BANDA.margen,
      w: DIBUJO.w - BANDA.izquierda - BANDA.derecha - 2 * BANDA.margen,
      h: DIBUJO.h - BANDA.arriba - BANDA.abajo - 2 * BANDA.margen
    };
    const SUELO_EXTRA = 4; // mm de suelo a cada lado
    const k = 1000 / escala;
    if (mostradas.length * w * k + HUECO + 2 * SUELO_EXTRA > disp.w || hm * k + 3 > disp.h) {
      return { cabe: false, fallos: [], escala, dibujo: { naves_dibujadas: mostradas.length } };
    }
    const Wp = mostradas.length * w * k + HUECO;
    const Hp = hm * k;
    const x0 = disp.x + (disp.w - Wp) / 2;
    const ySuelo = disp.y + (disp.h + Hp) / 2;
    const yCanal = ySuelo - hc * k, yCumbrera = ySuelo - hm * k;

    // Origen en papel de cada nave dibujada
    const origenNave = mostradas.map((_, i) => x0 + i * w * k + (corte && i === ultima ? HUECO : 0));
    // Líneas de pilares dibujadas (x en papel) con su índice real (para la letra del eje)
    const lineasPilares = [];
    mostradas.forEach((nave, i) => {
      const xa = origenNave[i], xb = xa + w * k;
      if (!lineasPilares.length || Math.abs(lineasPilares[lineasPilares.length - 1].x - xa) > 1e-6) lineasPilares.push({ x: xa, real: nave });
      lineasPilares.push({ x: xb, real: nave + 1 });
    });
    const xL = x0, xR = x0 + Wp;

    // --- Dibujo ---
    const dib = [];
    const tramosSuelo = corte
      ? [[xL - SUELO_EXTRA, origenNave[ultima - 1] + w * k], [origenNave[ultima], xR + SUELO_EXTRA]]
      : [[xL - SUELO_EXTRA, xR + SUELO_EXTRA]];
    for (const [a, b] of tramosSuelo) {
      dib.push(H.linea(a, ySuelo, b, ySuelo, LINEA.contorno));
      for (let x = a + 1; x < b - 1.5; x += 2.5) dib.push(H.linea(x, ySuelo + 0.2, x - 1.5, ySuelo + 1.7, LINEA.referencia));
    }
    const anchoPilar = Math.max(0.5, 0.12 * k);
    for (const p of lineasPilares) {
      dib.push(`<rect x="${p.x - anchoPilar / 2}" y="${yCanal}" width="${anchoPilar}" height="${ySuelo - yCanal}" fill="#000"/>`);
      const ac = Math.max(1.4, 0.3 * k), hcnl = Math.max(0.7, 0.15 * k);
      dib.push(`<rect x="${p.x - ac / 2}" y="${yCanal - hcnl}" width="${ac}" height="${hcnl}" fill="#fff" stroke="#000" stroke-width="${LINEA.cota}"/>`);
    }
    const arco = H.puntosArco(w, f);
    const papel = (xa, [x, h]) => `${(xa + x * k).toFixed(3)},${(yCanal - h * k).toFixed(3)}`;
    for (const xa of origenNave) {
      dib.push(`<polyline points="${arco.map(p => papel(xa, p)).join(' ')}" fill="none" stroke="#000" stroke-width="${LINEA.contorno}"/>`);
      if (seccion) dib.push(H.linea(xa, yCanal, xa + w * k, yCanal, LINEA.portico, 'stroke="#555"')); // tirante
    }
    // Alzado frontal: pilares de hastial intermedios, hasta el arco
    if (!seccion) {
      const porNave = Math.max(Math.round(w / (modelo.sep_pilares_hastial || w)) - 1, 0);
      for (const xa of origenNave) {
        for (let q = 1; q <= porNave; q++) {
          const xm = q * w / (porNave + 1);
          const h = hc + f * (1 - (2 * xm / w - 1) ** 2);
          dib.push(`<rect x="${xa + xm * k - anchoPilar * 0.35}" y="${ySuelo - h * k}" width="${anchoPilar * 0.7}" height="${h * k}" fill="#fff" stroke="#000" stroke-width="0.18"/>`);
        }
      }
    }
    // Alzado frontal: puertas del hastial frontal en las naves dibujadas
    const puertasFrente = seccion ? [] : H.puertasEnHastiales(g, modelo, puertas).filter(p => p.hastial === 0);
    for (const p of puertasFrente) {
      const i = mostradas.indexOf(p.nave);
      if (i < 0) continue;
      const xc = origenNave[i] + (p.centro - p.nave * w) * k;
      dib.push(`<rect x="${xc - p.ancho * k / 2}" y="${ySuelo - p.alto * k}" width="${p.ancho * k}" height="${p.alto * k}" fill="#e6e6e6" stroke="#000" stroke-width="0.35" data-puerta="0-${p.nave}"/>`);
      dib.push(H.linea(xc, ySuelo - p.alto * k, xc, ySuelo, 0.18));
    }
    // Sección: ventanas cenitales (cerrada sobre el arco y abierta a trazos)
    const alfa = seccion ? apertura(ventana) : 0;
    const lados = !seccion || !ventana || !ventana.lineas ? [] : ventana.lineas >= 2 ? [-1, 1] : [1];
    let puntoRotulo = null;
    for (const xa of origenNave) {
      const cumbre = [xa + w / 2 * k, yCumbrera];
      if (!lados.length) { puntoRotulo = cumbre; continue; }
      for (const lado of lados) {
        const pts = [];
        const [xf] = H.puntoDesdeCumbrera(w, f, ventana.hoja, lado);
        for (let i = 0; i <= 12; i++) {
          const x = w / 2 + (xf - w / 2) * i / 12;
          pts.push([x, f * (1 - (2 * x / w - 1) ** 2)]);
        }
        dib.push(`<polyline points="${pts.map(p => papel(xa, p)).join(' ')}" fill="none" stroke="#000" stroke-width="0.9"/>`);
        // Hoja abierta: la cuerda de la hoja girada α alrededor de la bisagra, hacia arriba
        const fin = [xa + pts[12][0] * k, yCanal - pts[12][1] * k];
        const v = [fin[0] - cumbre[0], fin[1] - cumbre[1]];
        const giro = (s) => [v[0] * Math.cos(s * alfa) - v[1] * Math.sin(s * alfa), v[0] * Math.sin(s * alfa) + v[1] * Math.cos(s * alfa)];
        const [a, b] = [giro(1), giro(-1)];
        const abierta = a[1] < b[1] ? a : b;
        dib.push(H.linea(cumbre[0], cumbre[1], cumbre[0] + abierta[0], cumbre[1] + abierta[1], 0.35, 'stroke-dasharray="1.2 0.8"'));
        if (lado === 1) puntoRotulo = [(cumbre[0] + fin[0]) / 2, (cumbre[1] + fin[1]) / 2];
      }
      if (!puntoRotulo) puntoRotulo = cumbre;
    }
    // Interrupción
    if (corte) {
      const xc = origenNave[ultima - 1] + w * k + HUECO / 2;
      const z = [[xc, yCumbrera - 3], [xc, (yCumbrera + ySuelo) / 2 - 1.5], [xc - 1.5, (yCumbrera + ySuelo) / 2 - 0.5],
                 [xc + 1.5, (yCumbrera + ySuelo) / 2 + 0.5], [xc, (yCumbrera + ySuelo) / 2 + 1.5], [xc, ySuelo + 3]];
      dib.push(`<polyline points="${z.map(p => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="${LINEA.cota}"/>`);
    }
    partes.push(`<g id="dibujo">${dib.join('')}</g>`);
    const cimaVentana = alfa ? yCumbrera - Math.sin(alfa) * ventana.hoja * k - 0.5 : yCumbrera;
    const huella = { x: xL - SUELO_EXTRA, y: Math.min(cimaVentana, yCumbrera - (corte ? 3 : 0)), w: Wp + 2 * SUELO_EXTRA, h: 0 };
    huella.h = ySuelo + (corte ? 3 : 1.8) - huella.y;
    reg.ocupar(huella, 'dibujo');

    // --- Ejes: letras en las líneas de pilares, arriba ---
    partes.push(H.burbujas(reg, { eje: 'h', posiciones: lineasPilares.map(p => p.x), etiquetas: lineasPilares.map(p => letra(p.real)), borde: huella.y, limite: DIBUJO }));

    // --- Cotas: anchos abajo; alturas (canal, flecha, cumbrera) a la izquierda ---
    const xs = lineasPilares.map(p => p.x);
    const abajo = huella.y + huella.h;
    partes.push(H.cadena(reg, { eje: 'h', posiciones: [xs[0], xs[xs.length - 1]], valores: [g.ancho_total], textos: [H.fmtCota(g.ancho_total)], origen: abajo, linea: abajo + COTA_2, limite: DIBUJO, nombre: 'ancho total' }));
    if (xs.length > 2) {
      const vanos = xs.slice(1).map((x, i) => (corte && i === ultima ? (n - mostradas.length) * w : w));
      const textos = corte ? vanos.map((v, i) => (i === ultima ? textoCorte : H.fmtCota(v))) : undefined;
      partes.push(H.cadena(reg, { eje: 'h', posiciones: xs, valores: vanos, textos, origen: abajo, linea: abajo + COTA_1, limite: DIBUJO, nombre: 'naves' }));
    }
    const izq = xL - SUELO_EXTRA;
    partes.push(H.cadena(reg, { eje: 'v', posiciones: [yCumbrera, ySuelo], valores: [hm], origen: izq, linea: izq - COTA_2, limite: DIBUJO, nombre: 'altura a cumbrera total' }));
    partes.push(H.cadena(reg, { eje: 'v', posiciones: [yCumbrera, yCanal, ySuelo], valores: [f, hc], origen: izq, linea: izq - COTA_1, limite: DIBUJO, nombre: 'canal y flecha' }));

    // --- Rótulo de la ventana cenital (sección) ---
    const notas = ['Cotas en metros. Alturas desde el suelo terminado.'];
    if (seccion) {
      let t, nota;
      if (!ventana || !ventana.lineas) {
        t = 'Techo cerrado (sin ventana cenital)';
        nota = 'Sin ventana cenital: la ventilación depende de los laterales.';
      } else {
        t = ventana.lineas >= 2 ? 'Ventana cenital mariposa' : 'Ventana cenital de una hoja';
        nota = `Hoja de ${H.fmtCota(ventana.hoja)} m; apertura aprox. ${grados(alfa)}° (rendija ${H.fmtCota(Math.min(ventana.rendija || ventana.hoja, ventana.hoja))} m).`;
      }
      const [px, py] = puntoRotulo;
      partes.push(H.rotulo(reg, { px, py, texto: t, largo: xR - px + 6, arriba: huella.y, limite: DIBUJO, nombre: 'ventana cenital' }));
      notas.push(nota);
    }
    notas.push('Arco: parábola de luz igual al ancho de nave y flecha del catálogo.');
    if (corte) notas.push(`Se dibujan ${mostradas.length} de las ${n} naves; la interrupción no está a escala.`);

    const simbolos = seccion
      ? [[`<rect x="-0.5" y="-1" width="1" height="2" fill="#000"/>`, 'Pilar'],
         [H.linea(-4, 0, 4, 0, LINEA.contorno), 'Arco'],
         [H.linea(-4, 0, 4, 0, LINEA.portico, 'stroke="#555"'), 'Tirante'],
         [H.linea(-4, 0, 4, 0, 0.9), 'Ventana cenital cerrada'],
         [H.linea(-4, 0, 4, 0, 0.35, 'stroke-dasharray="1.2 0.8"'), 'Ventana abierta'],
         [H.linea(-4, 0, 4, 0, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'), 'Eje']]
      : [[`<rect x="-0.5" y="-1" width="1" height="2" fill="#000"/>`, 'Pilar'],
         [`<rect x="-0.35" y="-1" width="0.7" height="2" fill="#fff" stroke="#000" stroke-width="0.18"/>`, 'Pilar de hastial'],
         [H.linea(-4, 0, 4, 0, LINEA.contorno), 'Arco'],
         [H.linea(-4, 0, 4, 0, LINEA.eje, 'stroke-dasharray="4 1 0.6 1"'), 'Eje'],
         ...(puertasFrente.length ? [[`<rect x="-2" y="-1" width="4" height="2" fill="#e6e6e6" stroke="#000" stroke-width="0.35"/>`, 'Puerta corredera']] : [])];
    if (puertasFrente.length) {
      const p = puertasFrente[0];
      notas.push(`Puertas en este frontal: ${puertasFrente.length} de ${H.fmtCota(p.ancho)} × ${H.fmtCota(p.alto)} m${p.entrePilares ? ', entre pilares de hastial' : ''}.`);
    }
    partes.push(H.hojaBase(reg, {
      escala, g, modelo, empresa, proyecto, fecha, simbolos, notas,
      titulo: seccion ? 'SECCIÓN TRANSVERSAL' : 'ALZADO FRONTAL', numero: seccion ? '04' : '02'
    }));

    return {
      svg: partes.join(''), viewBox: `0 0 ${H.A3.w} ${H.A3.h}`,
      escala, cajas: reg.cajas, fallos: reg.fallos, cabe: true,
      dibujo: { x: xL, y: yCumbrera, w: Wp, h: Hp, disponible: disp, corte, naves_dibujadas: mostradas.length, hueco: HUECO, apertura: alfa,
                puertas: puertasFrente.filter(p => mostradas.includes(p.nave)).length }
    };
  }

  const API = {
    alzadoFrontal: (datos) => seleccionar('frontal', datos),
    seccion: (datos) => seleccionar('seccion', datos),
    dibujarTransversal, navesDibujadas, COMPLETO_HASTA,
    apertura
  };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
