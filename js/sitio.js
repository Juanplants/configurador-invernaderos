// ============================================================
// Cargas del sitio por municipio (CTE DB SE-AE)
// ============================================================
// Los datos no están en el código: normativa en datos/cte_se_ae.json y
// municipios en datos/municipios_cte.csv (ver datos/LEEME_municipios.md);
// herramientas/municipios_a_js.js los junta en datos/municipios.js.
//
//   const { municipios, errores } = SITIO.leerCSV(texto)       // tabla de municipios
//   const errores = SITIO.validarNormativa(normativa)
//   const idx = SITIO.indice(municipios)                         // búsqueda por nombre y códigos
//   const c = SITIO.cargas(normativa, municipio, { categoria, altura })
//     → { viento: { zona, vb, qb, kmh, ce, qe }, nieve: { zona, altitud, sk, kgm2 } | null }
//
// Viento: velocidad básica vb de la zona eólica (anejo D). Para comparar con
// el viento declarado por el fabricante se usa vb en km/h; el coeficiente de
// exposición ce de la categoría de terreno a la altura de cumbrera y la presión
// qe = qb · ce son informativos. Nieve: sk de la tabla E.2 según zona climática
// de invierno y altitud (interpolación lineal entre filas), en kg/m².

(function (raiz) {
  const COLUMNAS = ['codigo_ine', 'codigo_catastro', 'provincia', 'municipio', 'altitud_m', 'zona_eolica', 'zona_invierno'];
  const KN_A_KG = 1000 / 9.80665;   // kN/m² → kg/m²
  const MS_A_KMH = 3.6;

  const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  // CSV separado por «;» (o «,»), UTF-8, con cabecera. Errores con su fila.
  function leerCSV(texto) {
    const errores = [], avisos = [];
    const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/);
    const sep = (lineas[0] || '').includes(';') ? ';' : ',';
    const cab = (lineas[0] || '').split(sep).map(c => c.trim().toLowerCase());
    const falta = COLUMNAS.filter(c => !cab.includes(c));
    if (falta.length) return { municipios: [], errores: [`Faltan columnas: ${falta.join(', ')} (se esperan ${COLUMNAS.join(';')})`], avisos };
    const col = Object.fromEntries(COLUMNAS.map(c => [c, cab.indexOf(c)]));
    const municipios = [];
    const vistos = new Set();
    lineas.slice(1).forEach((l, i) => {
      if (!l.trim() || l.trim().startsWith('#')) return;
      const fila = i + 2;
      const v = l.split(sep).map(x => x.trim());
      const m = {
        ine: v[col.codigo_ine], catastro: v[col.codigo_catastro] || '', provincia: v[col.provincia], nombre: v[col.municipio],
        altitud: Number(String(v[col.altitud_m]).replace(',', '.')), zona_eolica: String(v[col.zona_eolica] || '').toUpperCase(), zona_invierno: Number(v[col.zona_invierno])
      };
      const mal = [];
      if (!/^\d{5}$/.test(m.ine || '')) mal.push('código INE de 5 cifras');
      if (m.catastro && !/^\d{5}$/.test(m.catastro)) mal.push('código del Catastro de 5 cifras (provincia + municipio)');
      if (!m.nombre) mal.push('nombre del municipio');
      if (!Number.isFinite(m.altitud) || m.altitud < -50 || m.altitud > 4000) mal.push('altitud en metros');
      if (!['A', 'B', 'C'].includes(m.zona_eolica)) mal.push('zona eólica A, B o C');
      if (!(Number.isInteger(m.zona_invierno) && m.zona_invierno >= 1 && m.zona_invierno <= 7)) mal.push('zona climática de invierno de 1 a 7');
      if (mal.length) { errores.push(`Fila ${fila}: ${mal.join('; ')}`); return; }
      if (vistos.has(m.ine)) { errores.push(`Fila ${fila}: código INE ${m.ine} repetido`); return; }
      vistos.add(m.ine);
      municipios.push(m);
    });
    return { municipios, errores, avisos };
  }

  // La normativa tiene que estar completa en lo que se usa; la nieve puede
  // estar pendiente (entonces no se calcula y se pide a mano)
  function validarNormativa(n) {
    const errores = [];
    if (!n || typeof n !== 'object') return ['Falta la normativa (datos/cte_se_ae.json).'];
    for (const z of ['A', 'B', 'C']) {
      const d = n.viento && n.viento.zonas && n.viento.zonas[z];
      if (!d || !(d.vb > 0) || !(d.qb > 0)) errores.push(`Viento: falta vb o qb de la zona ${z}.`);
    }
    for (const c of ['I', 'II', 'III', 'IV', 'V']) {
      const d = n.categorias_terreno && n.categorias_terreno[c];
      if (!d || !(d.k > 0) || !(d.L > 0) || !(d.Z > 0) || !d.nombre) errores.push(`Categoría de terreno ${c}: faltan k, L, Z o el nombre.`);
    }
    if (nieveCompleta(n)) {
      const t = n.nieve.tabla;
      if (t.altitudes.some((a, i) => i && a <= t.altitudes[i - 1])) errores.push('Nieve: las altitudes de la tabla E.2 deben ir en orden creciente.');
    }
    return errores;
  }
  function nieveCompleta(n) {
    const t = n && n.nieve && n.nieve.tabla;
    return !!(t && Array.isArray(t.altitudes) && t.altitudes.length >= 2
      && [1, 2, 3, 4, 5, 6, 7].every(z => Array.isArray(t.zonas && t.zonas[z]) && t.zonas[z].length === t.altitudes.length && t.zonas[z].every(v => typeof v === 'number' && v >= 0)));
  }

  function indice(municipios) {
    const porIne = new Map(), porCatastro = new Map();
    const lista = municipios.map(m => Object.assign({ clave: normalizar(`${m.nombre} ${m.provincia}`), etiqueta: `${m.nombre} (${m.provincia})` }, m));
    for (const m of lista) { porIne.set(m.ine, m); if (m.catastro) porCatastro.set(m.catastro, m); }
    return {
      lista, porIne, porCatastro,
      // Por la etiqueta exacta «Nombre (Provincia)», o por el nombre si solo hay uno
      buscar(texto) {
        const t = normalizar(texto);
        if (!t) return null;
        const exacta = lista.find(m => normalizar(m.etiqueta) === t);
        if (exacta) return exacta;
        const mismos = lista.filter(m => normalizar(m.nombre) === t);
        return mismos.length === 1 ? mismos[0] : null;
      },
      sugerencias(texto, max = 20) {
        const t = normalizar(texto);
        return t ? lista.filter(m => m.clave.includes(t)).slice(0, max) : [];
      }
    };
  }

  // Municipio de una referencia catastral de rústica (20 caracteres): provincia + municipio del Catastro
  function municipioDeRefcat(refcat) {
    const r = String(refcat || '').trim().toUpperCase();
    return /^\d{5}[A-Z0-9]{15}$/.test(r) ? r.slice(0, 5) : null;
  }

  function exposicion(n, categoria, z) {
    const c = n.categorias_terreno[categoria];
    if (!c) return null;
    const F = c.k * Math.log(Math.max(z, c.Z) / c.L);
    return F * (F + 7 * c.k);
  }

  function nieve(n, zona, altitud) {
    if (!nieveCompleta(n)) return null;
    const { altitudes, zonas } = n.nieve.tabla;
    const v = zonas[zona];
    let sk;
    if (altitud <= altitudes[0]) sk = v[0];
    else if (altitud >= altitudes[altitudes.length - 1]) sk = v[v.length - 1];
    else {
      const i = altitudes.findIndex((a, j) => altitud >= a && altitud <= altitudes[j + 1]);
      const t = (altitud - altitudes[i]) / (altitudes[i + 1] - altitudes[i]);
      sk = v[i] + t * (v[i + 1] - v[i]);
    }
    return { zona, altitud, sk, kgm2: sk * KN_A_KG };
  }

  function cargas(n, m, { categoria = 'II', altura = 10 } = {}) {
    const z = n.viento.zonas[m.zona_eolica];
    const ce = exposicion(n, categoria, altura);
    return {
      viento: { zona: m.zona_eolica, vb: z.vb, qb: z.qb, kmh: z.vb * MS_A_KMH, categoria, altura, ce, qe: ce === null ? null : z.qb * ce },
      nieve: nieve(n, m.zona_invierno, m.altitud)
    };
  }

  // Junta normativa y municipios en el objeto que carga la app (datos/municipios.js)
  function empaquetar(normativa, csv, meta) {
    return {
      normativa,
      municipios: Object.assign({}, meta, { filas: csv.municipios.map(m => [m.ine, m.catastro, m.provincia, m.nombre, m.altitud, m.zona_eolica, m.zona_invierno]) })
    };
  }
  function desempaquetar(d) {
    const filas = (d && d.municipios && d.municipios.filas) || [];
    return filas.map(([ine, catastro, provincia, nombre, altitud, zona_eolica, zona_invierno]) => ({ ine, catastro, provincia, nombre, altitud, zona_eolica, zona_invierno }));
  }

  const API = { COLUMNAS, KN_A_KG, MS_A_KMH, leerCSV, validarNormativa, nieveCompleta, indice, municipioDeRefcat, exposicion, nieve, cargas, empaquetar, desempaquetar, normalizar };
  raiz.SITIO = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
