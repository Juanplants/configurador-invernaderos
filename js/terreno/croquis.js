// ============================================================
// Croquis en planta de una implantación (tarjetas del optimizador)
// ============================================================
// CROQUIS.svg(anillos, { implantacion, largo, ancho, naves }) → SVG
// Norte arriba, como el plano de emplazamiento (salvo que este gire la hoja
// entera): x al este, y al norte, en metros. El invernadero lleva sus esquinas en
// data-invernadero (la primera arista es el largo) para comparar la orientación.

(function (raiz) {
  const PAR = raiz.PARCELA || (typeof require !== 'undefined' && require('./parcela.js'));
  const f = (v) => (Math.round(v * 100) / 100).toString();

  function svg(anillos, c) {
    const pts = anillos[0];
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const m = Math.max(x1 - x0, y1 - y0) * 0.06;
    const papel = ([x, y]) => [x, -y];   // norte arriba
    const d = (a) => 'M' + a.map(papel).map(([x, y]) => `${f(x)},${f(y)}`).join(' L') + ' Z';
    const imp = c.implantacion;
    const r = PAR.esquinas({ cx: imp.cx, cy: imp.cy, azimut: imp.azimut, largo: c.largo, ancho: c.ancho });
    const canales = [];
    for (let j = 1; j < c.naves; j++) {
      const t = j / c.naves;
      const a = papel([r[0][0] + t * (r[3][0] - r[0][0]), r[0][1] + t * (r[3][1] - r[0][1])]);
      const b = papel([r[1][0] + t * (r[2][0] - r[1][0]), r[1][1] + t * (r[2][1] - r[1][1])]);
      canales.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`);
    }
    const ancho = x1 - x0 + 2 * m;
    const esq = r.map(papel).map(q => q.map(f).join(',')).join(' ');
    return `<svg class="croquis" viewBox="${f(x0 - m)} ${f(-y1 - m)} ${f(ancho)} ${f(y1 - y0 + 2 * m)}" preserveAspectRatio="xMidYMid meet">`
      + `<path d="${anillos.map(d).join(' ')}" fill="#f4f4f4" fill-rule="evenodd" stroke="#333" stroke-width="${f(ancho / 200)}" stroke-dasharray="${f(ancho / 40)} ${f(ancho / 120)}"/>`
      + `<path data-invernadero="${esq}" d="${d(r)}" fill="#b9d7b0" stroke="#1b5e20" stroke-width="${f(ancho / 160)}"/>`
      + `<g stroke="#1b5e20" stroke-width="${f(ancho / 400)}">${canales.join('')}</g>`
      + `<text x="${f(x1 + m * 0.2)}" y="${f(-y1 + m * 0.4)}" font-size="${f(ancho / 14)}" text-anchor="end" font-family="sans-serif" fill="#666">N ↑</text>`
      + '</svg>';
  }

  // Ángulo (grados desde arriba, horario, módulo 180) de la primera arista de
  // data-invernadero en un SVG: sirve igual para el croquis y para el plano
  function anguloInvernadero(textoSvg) {
    const m = String(textoSvg).match(/data-invernadero="([^"]+)"/);
    if (!m) return null;
    const [a, b] = m[1].trim().split(/\s+/).map(p => p.split(',').map(Number));
    return ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI) % 180 + 180) % 180;
  }

  const API = { svg, anguloInvernadero };
  raiz.CROQUIS = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
