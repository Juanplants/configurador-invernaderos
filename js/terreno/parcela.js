// ============================================================
// Parcela: lectura del GML/KML del Catastro y geometría plana
// ============================================================
// Todo en metros, en un plano local con origen en el centroide de la parcela,
// x hacia el este y y hacia el norte geográfico. Así el norte del plano es el
// norte verdadero, venga la parcela de UTM (GML) o de longitud/latitud (KML).
//
//   const p = PARCELA.leer(texto, nombreArchivo)
//   → { anillos: [exterior, ...huecos], meta: { formato, srs, refcat, area, area_declarada, … },
//       errores: [], avisos: [] }
//   anillo: [[x, y], …] sin repetir el primer punto; exterior antihorario.
//   PARCELA.rectangulo(largo, ancho, azimut) → anillos de una parcela rectangular.

(function (raiz) {
  // ---------- Elipsoide GRS80 (ETRS89; WGS84 difiere en < 0,1 mm) ----------
  const A = 6378137, F = 1 / 298.257222101, E2 = F * (2 - F);
  const rad = (g) => g * Math.PI / 180, grad = (r) => r * 180 / Math.PI;

  // UTM → longitud/latitud (Snyder, «Map Projections», fórmulas 8-18 a 8-25)
  function utmAGeo(E, N, huso, norte = true) {
    const k0 = 0.9996, e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2)), ep2 = E2 / (1 - E2);
    const x = E - 500000, y = norte ? N : N - 10000000;
    const M = y / k0;
    const mu = M / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
    const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
    const C1 = ep2 * c * c, T1 = t * t, N1 = A / Math.sqrt(1 - E2 * s * s), R1 = A * (1 - E2) / (1 - E2 * s * s) ** 1.5;
    const D = x / (N1 * k0);
    const lat = phi1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon0 = rad((huso - 1) * 6 - 180 + 3);
    const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return [grad(lon), grad(lat)];
  }

  // Longitud/latitud → plano local (m) alrededor de (lon0, lat0), con los radios del elipsoide.
  // Error < 1 cm en parcelas de cientos de metros.
  function geoALocal(puntos, lon0, lat0) {
    const s = Math.sin(rad(lat0));
    const Nr = A / Math.sqrt(1 - E2 * s * s), Mr = A * (1 - E2) / (1 - E2 * s * s) ** 1.5;
    return puntos.map(([lon, lat]) => [rad(lon - lon0) * Nr * Math.cos(rad(lat0)), rad(lat - lat0) * Mr]);
  }

  // ---------- Geometría plana ----------
  const areaFirmada = (a) => a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const area = (a) => Math.abs(areaFirmada(a));
  function centroide(a) {
    let cx = 0, cy = 0, A2 = 0;
    a.forEach((p, i) => { const q = a[(i + 1) % a.length], c = p[0] * q[1] - q[0] * p[1]; A2 += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; });
    return A2 ? [cx / (3 * A2), cy / (3 * A2)] : a[0];
  }
  function dentro([x, y], a) {
    let d = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i], [xj, yj] = a[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d;
    }
    return d;
  }
  // Distancia de un punto a un segmento
  function distPuntoSegmento([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function seCortan(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function distSegmentos(a, b, c, d) {
    if (seCortan(a, b, c, d)) return 0;
    return Math.min(distPuntoSegmento(a, c, d), distPuntoSegmento(b, c, d), distPuntoSegmento(c, a, b), distPuntoSegmento(d, a, b));
  }
  const aristas = (a) => a.map((p, i) => [p, a[(i + 1) % a.length]]);

  // Esquinas de un rectángulo { cx, cy, azimut (del largo, grados desde el norte), largo, ancho }
  function esquinas({ cx, cy, azimut, largo, ancho }) {
    const d = [Math.sin(rad(azimut)), Math.cos(rad(azimut))], e = [d[1], -d[0]];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) =>
      [cx + s * largo / 2 * d[0] + t * ancho / 2 * e[0], cy + s * largo / 2 * d[1] + t * ancho / 2 * e[1]]);
  }

  // Distancia mínima entre el rectángulo y los linderos (anillos), con los puntos más cercanos;
  // negativa si el rectángulo se sale de la parcela o pisa un hueco
  function holguraRect(anillos, rect) {
    const R = esquinas(rect), ladosR = aristas(R);
    const [ext, ...huecos] = anillos;
    if (!R.every(p => dentro(p, ext))) return { distancia: -1 };
    for (const h of huecos) if (R.some(p => dentro(p, h)) || h.some(p => dentro(p, R))) return { distancia: -1 };
    if (ext.some(p => dentro(p, R))) return { distancia: -1 };
    let mejor = { distancia: Infinity };
    for (const anillo of anillos) {
      for (const [a, b] of aristas(anillo)) {
        for (const [c, d] of ladosR) {
          if (seCortan(a, b, c, d)) return { distancia: -1 };
          // Puntos más cercanos entre los dos segmentos (se prueban los extremos)
          for (const [p, s0, s1] of [[a, c, d], [b, c, d], [c, a, b], [d, a, b]]) {
            const dist = distPuntoSegmento(p, s0, s1);
            if (dist < mejor.distancia) {
              const dx = s1[0] - s0[0], dy = s1[1] - s0[1], l2 = dx * dx + dy * dy;
              const t = l2 ? Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / l2)) : 0;
              const q = [s0[0] + t * dx, s0[1] + t * dy];
              const enRect = (p === c || p === d);
              mejor = { distancia: dist, desde: enRect ? p : q, hasta: enRect ? q : p };
            }
          }
        }
      }
    }
    return mejor;
  }

  // Parcela rectangular manual como polígono: lado largo con el azimut dado
  function rectangulo(largo, ancho, azimut = 0) {
    return [esquinas({ cx: 0, cy: 0, azimut, largo, ancho })];
  }

  // ---------- Lectura de archivos ----------
  const numeros = (t) => String(t).trim().split(/[\s,]+/).filter(Boolean).map(Number);
  function limpiar(anillo) {
    const r = [];
    for (const p of anillo) if (!r.length || Math.hypot(p[0] - r[r.length - 1][0], p[1] - r[r.length - 1][1]) > 1e-6) r.push(p);
    if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1e-6) r.pop();
    return r;
  }
  const bloques = (t, etiqueta) => [...t.matchAll(new RegExp(`<(?:\\w+:)?${etiqueta}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${etiqueta}>`, 'g'))].map(m => m[1]);
  const primero = (t, etiqueta) => (bloques(t, etiqueta)[0] || '').replace(/<[^>]+>/g, '').trim();

  // Anillo de un bloque GML: posList (con srsDimension), una lista de pos, o coordinates (GML 2)
  function anilloGml(bloque) {
    const dim = +((bloque.match(/srsDimension="(\d)"/) || [])[1] || 2);
    const pl = bloques(bloque, 'posList')[0];
    let v;
    if (pl !== undefined) v = numeros(pl);
    else if (/<(?:\w+:)?pos\b/.test(bloque)) v = bloques(bloque, 'pos').flatMap(numeros);
    else v = numeros(bloques(bloque, 'coordinates')[0] || '');
    const r = [];
    for (let i = 0; i + 1 < v.length; i += dim) r.push([v[i], v[i + 1]]);
    return r;
  }

  function leerGml(t, avisos, errores) {
    const srs = (t.match(/srsName="([^"]+)"/) || [])[1] || '';
    const epsg = +((srs.match(/(\d{4,5})\s*$/) || [])[1] || 0);
    // Cada polígono: su exterior y sus huecos
    // gml:Polygon, o gml:PolygonPatch dentro de gml:Surface (formato INSPIRE del Catastro)
    const poligonos = [...bloques(t, 'Polygon'), ...bloques(t, 'PolygonPatch')].map(p => ({
      exterior: anilloGml((bloques(p, 'exterior')[0] || bloques(p, 'outerBoundaryIs')[0] || '')),
      huecos: [...bloques(p, 'interior'), ...bloques(p, 'innerBoundaryIs')].map(anilloGml)
    })).filter(p => p.exterior.length >= 3);
    if (!poligonos.length) { errores.push('El GML no contiene ningún polígono.'); return null; }
    // Coordenadas a longitud/latitud según el sistema
    let aGeo;
    const huso = (epsg >= 25828 && epsg <= 25831) ? epsg - 25800 : (epsg >= 32628 && epsg <= 32631) ? epsg - 32600
      : (epsg >= 23028 && epsg <= 23031) ? epsg - 23000 : 0;
    if (huso) aGeo = (a) => a.map(([e, n]) => utmAGeo(e, n, huso));
    else if (epsg === 4258 || epsg === 4326) aGeo = (a) => a.map(([lat, lon]) => [lon, lat]); // GML 3.2: latitud, longitud
    else { errores.push(`Sistema de coordenadas no admitido (${srs || 'sin indicar'}). Se admiten ETRS89/WGS84 UTM husos 28-31 y geográficas.`); return null; }
    if (epsg >= 23028 && epsg <= 23031) avisos.push('Coordenadas en ED50: la forma y las medidas son válidas; la posición absoluta puede diferir unos 100 m.');
    if (poligonos.length > 1) avisos.push(`El archivo tiene ${poligonos.length} recintos: se usa el mayor.`);
    const mayor = poligonos.map(p => ({ p, a: area(p.exterior) })).sort((x, y) => y.a - x.a)[0].p;
    const refcat = primero(t, 'nationalCadastralReference') || primero(t, 'localId') || '';
    const areaDeclarada = parseFloat(primero(t, 'areaValue')) || null;
    return { formato: 'GML', srs: `EPSG:${epsg}`, refcat, area_declarada: areaDeclarada, geo: [mayor.exterior, ...mayor.huecos].map(aGeo) };
  }

  function leerKml(t, avisos, errores) {
    // coordinates: lon,lat[,alt] separados por espacios
    const aAnillo = (texto) => {
      const puntos = String(texto).trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(v => v.length >= 2 && v.every(Number.isFinite));
      return puntos.map(([lon, lat]) => [lon, lat]);
    };
    const polis = bloques(t, 'Polygon').map(p => ({
      exterior: aAnillo(bloques((bloques(p, 'outerBoundaryIs')[0] || ''), 'coordinates')[0] || ''),
      huecos: bloques(p, 'innerBoundaryIs').map(h => aAnillo(bloques(h, 'coordinates')[0] || ''))
    })).filter(p => p.exterior.length >= 3);
    if (!polis.length) { errores.push('El KML no contiene ningún polígono.'); return null; }
    if (polis.length > 1) avisos.push(`El archivo tiene ${polis.length} recintos: se usa el mayor.`);
    const aprox = (a) => { const lat = a[0][1]; return area(a.map(([lo, la]) => [lo * Math.cos(rad(lat)), la])); };
    const mayor = polis.map(p => ({ p, a: aprox(p.exterior) })).sort((x, y) => y.a - x.a)[0].p;
    const nombres = bloques(t, 'name').map(n => n.replace(/<[^>]+>/g, '').trim());
    const nombre = nombres[0] || '';
    const refcat = nombres.map(n => (n.match(/\b[0-9A-Z]{14}(?:[0-9A-Z]{6})?\b/) || [])[0]).find(Boolean) || '';
    return { formato: 'KML', srs: 'WGS84 (lon/lat)', refcat, nombre, area_declarada: null, geo: [mayor.exterior, ...mayor.huecos] };
  }

  function leer(texto, nombreArchivo = '') {
    const errores = [], avisos = [];
    const t = String(texto || '');
    const esKml = /<kml\b/i.test(t) || /\.kml$/i.test(nombreArchivo);
    const esGml = /<(?:\w+:)?(?:FeatureCollection|CadastralParcel|Polygon|PolygonPatch)\b/.test(t) && !esKml;
    if (!esKml && !esGml) return { anillos: null, meta: null, errores: ['El archivo no es un GML ni un KML con una parcela.'], avisos };
    const r = esKml ? leerKml(t, avisos, errores) : leerGml(t, avisos, errores);
    if (!r) return { anillos: null, meta: null, errores, avisos };
    // Plano local con origen en el centroide aproximado (lon/lat medios)
    const ext = r.geo[0];
    const lon0 = ext.reduce((s, p) => s + p[0], 0) / ext.length, lat0 = ext.reduce((s, p) => s + p[1], 0) / ext.length;
    let anillos = r.geo.map(a => limpiar(geoALocal(a, lon0, lat0)));
    if (anillos[0].length < 3) return { anillos: null, meta: null, errores: ['El polígono de la parcela tiene menos de 3 vértices.'], avisos };
    // Centrar en el centroide y orientar: exterior antihorario, huecos horario
    const [gx, gy] = centroide(anillos[0]);
    anillos = anillos.map(a => a.map(([x, y]) => [x - gx, y - gy]));
    anillos = anillos.map((a, i) => ((i === 0) === (areaFirmada(a) < 0) ? a.slice().reverse() : a));
    const huecos = anillos.length - 1;
    if (huecos) avisos.push(`La parcela tiene ${huecos} hueco${huecos > 1 ? 's' : ''} interior${huecos > 1 ? 'es' : ''}: el invernadero no se colocará encima.`);
    const sup = area(anillos[0]) - anillos.slice(1).reduce((s, h) => s + area(h), 0);
    if (r.area_declarada && Math.abs(sup - r.area_declarada) / r.area_declarada > 0.02) {
      avisos.push(`La superficie del polígono (${Math.round(sup)} m²) difiere más de un 2 % de la declarada (${Math.round(r.area_declarada)} m²).`);
    }
    return {
      anillos, errores, avisos,
      meta: { formato: r.formato, srs: r.srs, refcat: r.refcat, nombre: r.nombre || '', archivo: nombreArchivo, area: sup,
        area_declarada: r.area_declarada, vertices: anillos[0].length, huecos, lon0, lat0 }
    };
  }

  const API = { leer, rectangulo, utmAGeo, geoALocal, area, areaFirmada, centroide, dentro, esquinas, holguraRect,
    distPuntoSegmento, distSegmentos, seCortan, aristas };
  raiz.PARCELA = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
