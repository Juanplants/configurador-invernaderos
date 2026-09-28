// ============================================================
// Hoja A3 de emplazamiento (05)
// ============================================================
// PLANOS_A3.emplazamiento({ g, modelo, empresa, proyecto, fecha,
//   parcela: { largo, ancho, orientacion, girado } })
//   largo, ancho: m; orientacion: azimut del lado largo de la parcela, en grados
//   desde el norte (sentido horario); girado: invernadero a 90° de la parcela.
// → { svg, viewBox, escala, cajas, fallos, dibujo, cabe, encaje }
//
// Parcela rectangular introducida a mano (la del catastro llega en la fase 6).
// El invernadero va centrado, con su largo paralelo al largo de la parcela
// (o girado 90°). Se acotan las distancias a los cuatro linderos. Si no cabe,
// se dibuja igual, sin distancias, con un aviso y cuánto falta.

(function (raiz) {
  const H = raiz.HOJA || (typeof require !== 'undefined' && require('./hoja.js'));
  const { DIBUJO, LINEA } = H;

  const BANDA = { arriba: 20, izquierda: 12, abajo: 22, derecha: 22, margen: 4 };
  const COTA_1 = 8, COTA_2 = 16;
  const EPS = 0.005; // m: una distancia menor se trata como 0 (invernadero pegado al lindero)

  // Geometría del encaje, en ejes del papel (x = lado más largo de la parcela)
  function encaje(g, parcela) {
    const { largo: PL, ancho: PA, orientacion = 0, girado = false } = parcela;
    const parcelaLargoEnX = PL >= PA;
    const Lg = girado ? g.ancho_total : g.largo;       // invernadero a lo largo de la parcela
    const Ag = girado ? g.largo : g.ancho_total;       // y a lo ancho
    const PX = parcelaLargoEnX ? PL : PA, PY = parcelaLargoEnX ? PA : PL;
    const GX = parcelaLargoEnX ? Lg : Ag, GY = parcelaLargoEnX ? Ag : Lg;
    const dx = (PX - GX) / 2, dy = (PY - GY) / 2;
    const cabe = dx >= -1e-9 && dy >= -1e-9;
    // Azimut del eje x del papel y ángulo del norte en el papel (grados desde arriba, horario)
    const azX = parcelaLargoEnX ? orientacion : orientacion - 90;
    const norte = ((90 - azX) % 360 + 360) % 360;
    return {
      cabe, PX, PY, GX, GY, dx, dy, norte,
      invernaderoLargoEnX: parcelaLargoEnX !== !!girado,
      // Azimut del largo del invernadero (para el norte de la planta)
      azimutInvernadero: (((girado ? orientacion + 90 : orientacion) % 360) + 360) % 360,
      faltaLargo: Math.max(0, Lg - PL), faltaAncho: Math.max(0, Ag - PA),
      ocupacion: (g.largo * g.ancho_total) / (PL * PA)
    };
  }

  function emplazamiento(datos) {
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
        : `No cabe: faltan ${[e.faltaLargo > 0 ? `${fmt(e.faltaLargo)} m a lo largo` : '', e.faltaAncho > 0 ? `${fmt(e.faltaAncho)} m a lo ancho` : ''].filter(Boolean).join(' y ')} de la parcela.`,
      'Parcela rectangular introducida a mano; la real (catastro) llegará en la fase 6.'
    ];
    partes.push(H.hojaBase(reg, {
      escala, g, modelo, empresa, proyecto, fecha, notas, norte: e.norte,
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

  const API = { emplazamiento, dibujarEmplazamiento, encaje };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
