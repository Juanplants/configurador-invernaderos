// ============================================================
// Importador del catálogo (fase 1)
// ============================================================
// Lee la plantilla .xlsx del distribuidor con SheetJS (lib/) y la
// convierte igual que herramientas/catalogo_a_json.py: cabecera en la
// fila 4, datos desde la fila 6, claves en snake_case y precios como
// número. Después la valida; el catálogo solo se acepta sin errores.
//
//   const { catalogo, errores, avisos } = IMPORTADOR.importar(XLSX, datos)
//   datos: ArrayBuffer o Uint8Array (navegador) / Buffer (node)
//   errores y avisos: [{ hoja, fila, columna, codigo, texto }]

(function (raiz) {
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const M = raiz.MOTOR || {};
  const EXPR = M.expresiones || req('./motor/expresiones.js');
  const GEO = M.geometria || req('./motor/geometria.js');
  const MAT = M.materiales || req('./motor/materiales.js');
  const MOTOR = M.calcular ? M : req('./motor/motor.js');

  const HOJAS = ['Empresa', 'Modelos', 'Perfiles', 'Componentes', 'Cubiertas', 'Equipos', 'Obra local'];
  const FILA_CABECERA = 4;
  const FILA_DATOS = 6;
  // Columnas que se guardan como número aunque vengan como texto ("1,4")
  const NUMERICAS = ['precio', 'precio_unitario', 'movilizacion', 'montaje', 'hoyos_y_dados'];
  // Medidas que se pasan a número si vienen como texto; si no son número, las rechaza el validador
  const MEDIDAS_TEXTO = ['ancho_puerta', 'alto_puerta'];
  const MEDIDAS = {
    anchos_de_nave_admitidos: 'anchos de nave admitidos',
    separaciones_entre_porticos: 'separaciones entre pórticos',
    alturas_a_canal_admitidas: 'alturas a canal admitidas'
  };

  // "Máx. longitud" → "max_longitud" (igual que clave() en catalogo_a_json.py)
  function clave(texto) {
    return String(texto).normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  }

  // Número escrito con punto o coma decimal; cualquier otra cosa → NaN
  function aNumero(v) {
    if (typeof v === 'number') return v;
    const t = String(v).trim().replace(',', '.');
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? parseFloat(t) : NaN;
  }

  const vacio = (v) => v === undefined || v === null || v === '';
  const lista = (v, sep) => String(v).split(sep).map(s => s.trim());

  // ---------- Lectura ----------
  function leerHoja(XLSX, ws, hoja, avisos) {
    const rango = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const valor = (r, c) => {
      const celda = ws[XLSX.utils.encode_cell({ r, c })];
      return celda ? celda.v : undefined;
    };
    const cab = [];
    const titulos = {};
    for (let c = 0; c <= rango.e.c; c++) {
      const v = valor(FILA_CABECERA - 1, c);
      if (!vacio(v)) { cab[c] = clave(v); titulos[cab[c]] = String(v); }
    }
    const datos = [];
    const filas = [];
    for (let r = FILA_DATOS - 1; r <= rango.e.r; r++) {
      if (vacio(valor(r, 0))) continue;
      const d = {};
      for (let c = 0; c <= rango.e.c; c++) {
        const v = valor(r, c);
        if (cab[c] && !vacio(v)) d[cab[c]] = v;
      }
      for (const k of NUMERICAS) {
        if (!(k in d) || typeof d[k] === 'number') continue;
        const n = aNumero(d[k]);
        if (Number.isFinite(n)) d[k] = n;
        else {
          avisos.push({ hoja, fila: r + 1, columna: titulos[k], codigo: 'precio',
            texto: `"${d[k]}" no es un número: se trata como sin precio` });
          delete d[k];
        }
      }
      for (const k of MEDIDAS_TEXTO) {
        if (typeof d[k] === 'string' && Number.isFinite(aNumero(d[k]))) d[k] = aNumero(d[k]);
      }
      datos.push(d);
      filas.push(r + 1);
    }
    return { datos, filas, titulos };
  }

  function importar(XLSX, datos) {
    const errores = [];
    const avisos = [];
    let libro;
    try {
      const tipo = (typeof Buffer !== 'undefined' && Buffer.isBuffer(datos)) ? 'buffer' : 'array';
      libro = XLSX.read(datos, { type: tipo });
    } catch (e) {
      errores.push({ hoja: null, fila: null, columna: null, codigo: 'archivo', texto: `No se puede leer el archivo como Excel: ${e.message}` });
      return { catalogo: null, errores, avisos };
    }
    const catalogo = {};
    const meta = {};
    for (const hoja of HOJAS) {
      const ws = libro.Sheets[hoja];
      if (!ws) {
        errores.push({ hoja, fila: null, columna: null, codigo: 'hoja', texto: `Falta la hoja "${hoja}"` });
        catalogo[clave(hoja)] = [];
        continue;
      }
      const leida = leerHoja(XLSX, ws, hoja, avisos);
      catalogo[clave(hoja)] = leida.datos;
      meta[clave(hoja)] = leida;
    }
    catalogo.empresa = catalogo.empresa[0] || {};
    const v = validar(catalogo, meta);
    return { catalogo, errores: errores.concat(v.errores), avisos: avisos.concat(v.avisos) };
  }

  // ---------- Validación ----------
  // meta: { hoja: { filas: [nº de fila Excel por índice], titulos: {clave: título} } }
  // Sin meta (catálogo JSON) los mensajes salen sin nº de fila.
  function validar(cat, meta = {}) {
    const errores = [];
    const avisos = [];
    const NOMBRE = Object.fromEntries(HOJAS.map(h => [clave(h), h]));
    const anotar = (destino) => (hoja, i, campo, codigo, texto) => destino.push({
      hoja: NOMBRE[hoja],
      fila: meta[hoja] && i !== null ? meta[hoja].filas[i] : null,
      columna: campo ? ((meta[hoja] && meta[hoja].titulos[campo]) || campo) : null,
      codigo, texto
    });
    const error = anotar(errores);
    const aviso = anotar(avisos);

    const modelos = cat.modelos || [];
    const componentes = cat.componentes || [];
    if (!modelos.length) error('modelos', null, null, 'modelo', 'El catálogo no tiene ningún modelo');

    // Id repetidos: en cada hoja, y entre Perfiles/Cubiertas/Equipos (las Ref buscan en las tres)
    const vistos = new Map();
    for (const hoja of ['modelos', 'componentes', 'perfiles', 'cubiertas', 'equipos']) {
      const ambito = ['perfiles', 'cubiertas', 'equipos'].includes(hoja) ? 'ref' : hoja;
      (cat[hoja] || []).forEach((f, i) => {
        const k = `${ambito}:${f.id}`;
        if (vistos.has(k)) error(hoja, i, 'id', 'duplicado', `Id "${f.id}" repetido (ya está en ${vistos.get(k)})`);
        else vistos.set(k, NOMBRE[hoja]);
      });
    }

    // Empresa
    const emp = cat.empresa || {};
    if (!vacio(emp.iva) && !Number.isFinite(aNumero(emp.iva))) {
      error('empresa', 0, 'iva', 'numero', `IVA "${emp.iva}" no es un número`);
    }

    // Modelos: medidas admitidas y flecha
    const modeloValido = {};
    modelos.forEach((m, i) => {
      let ok = true;
      for (const [campo, texto] of Object.entries(MEDIDAS)) {
        const partes = vacio(m[campo]) ? [] : lista(m[campo], ';').filter(Boolean);
        const malas = partes.filter(p => !(aNumero(p) > 0) || p.includes(','));
        if (!partes.length) { error('modelos', i, campo, 'medidas', `Modelo ${m.id}: sin ${texto}`); ok = false; }
        else if (malas.length) { error('modelos', i, campo, 'medidas', `Modelo ${m.id}: ${texto} con valores no válidos (${malas.map(x => `"${x}"`).join(', ')}); usar números con punto decimal separados por ";"`); ok = false; }
      }
      if (typeof m.flecha_del_arco !== 'number' || !(m.flecha_del_arco >= 0)) {
        error('modelos', i, 'flecha_del_arco', 'medidas', `Modelo ${m.id}: flecha del arco vacía o no numérica`);
        ok = false;
      }
      modeloValido[m.id] = ok;
    });

    // Perfiles: el peso es imprescindible para pasar de metros a kg
    (cat.perfiles || []).forEach((p, i) => {
      if (typeof p.peso !== 'number' || !(p.peso > 0)) error('perfiles', i, 'peso', 'numero', `Perfil ${p.id}: peso (kg/m) vacío o no numérico`);
    });

    // Puertas: medidas para dibujarlas en planta y alzado frontal
    (cat.equipos || []).forEach((e, i) => {
      if (e.tipo !== 'puerta') return;
      for (const campo of ['ancho_puerta', 'alto_puerta']) {
        const nombre = (meta.equipos && meta.equipos.titulos[campo]) || campo;
        if (vacio(e[campo])) aviso('equipos', i, campo, 'puerta', `Puerta ${e.id}: sin ${nombre.toLowerCase()}; no se dibujará en los planos`);
        else if (typeof e[campo] !== 'number' || !(e[campo] > 0)) error('equipos', i, campo, 'numero', `Puerta ${e.id}: ${nombre.toLowerCase()} "${e[campo]}" no es una medida válida (m)`);
      }
    });

    // Variables de las reglas, con un proyecto de prueba de cada modelo
    const variables = {};
    for (const m of modelos) {
      if (!modeloValido[m.id]) continue;
      const g = GEO.calcular(m, { naves: 3, tramos: 10, puertas: 1 });
      variables[m.id] = Object.assign({}, g, { superficie_ventanas: 1 });
    }

    // Componentes
    componentes.forEach((c, i) => {
      const ids = vacio(c.modelos) ? [] : lista(c.modelos, ';').filter(Boolean);
      if (!ids.length) error('componentes', i, 'modelos', 'modelo', `${c.id}: sin modelos`);
      for (const id of ids) {
        if (!modelos.some(m => m.id === id)) error('componentes', i, 'modelos', 'modelo', `${c.id}: el modelo "${id}" no está en la hoja Modelos`);
      }

      if (!MAT.REGLAS.includes(c.regla)) {
        error('componentes', i, 'regla', 'regla', `${c.id}: regla "${c.regla ?? ''}" desconocida (válidas: ${MAT.REGLAS.join(', ')})`);
      }

      // Variantes por modelo con "|": tantas como modelos tiene la fila
      const variantesOk = {};
      for (const campo of ['ref', 'factor', 'formula_avanzada']) {
        variantesOk[campo] = true;
        const v = c[campo];
        if (typeof v === 'string' && v.includes('|') && lista(v, '|').length !== ids.length) {
          error('componentes', i, campo, 'variantes', `${c.id}: ${lista(v, '|').length} variantes separadas por "|" pero la fila tiene ${ids.length} modelo${ids.length === 1 ? '' : 's'}`);
          variantesOk[campo] = false;
        }
      }

      // Referencias
      if (!vacio(c.ref)) {
        for (const ref of new Set(lista(c.ref, '|'))) {
          if (!MAT.buscar(cat, ref)) error('componentes', i, 'ref', 'ref', `${c.id}: la referencia "${ref}" no existe en Perfiles, Cubiertas ni Equipos`);
        }
      }

      // Fórmulas y factores: se evalúan con las variables de cada modelo de la fila
      if (c.regla === 'formula' && vacio(c.formula_avanzada)) {
        error('componentes', i, 'formula_avanzada', 'formula', `${c.id}: la regla "formula" necesita una fórmula avanzada`);
      }
      const fallos = new Set();
      ids.forEach((id, j) => {
        if (!variables[id]) return;
        for (const campo of ['factor', 'formula_avanzada']) {
          if (vacio(c[campo]) || !variantesOk[campo]) continue;
          if (campo === 'formula_avanzada' && c.regla !== 'formula') continue;
          try { EXPR.evaluar(MAT.variante(c[campo], j), variables[id]); }
          catch (e) { fallos.add(`${campo}|${e.message}`); }
        }
      });
      for (const f of fallos) {
        const [campo, msg] = f.split(/\|(.*)/s);
        error('componentes', i, campo, 'formula', `${c.id}: ${msg}`);
      }

      // Precio: de la Ref o de la columna Precio unitario (aviso, no error)
      if (c.regla !== 'porcentaje' && variantesOk.ref) {
        const sinPrecio = new Set();
        ids.forEach((id, j) => {
          const refId = MAT.variante(c.ref, j);
          const ref = MAT.buscar(cat, refId);
          if (!vacio(c.ref) && !ref) return; // ya es error de referencia
          const esPerfil = ref && ref.hoja === 'perfiles' && c.unidad === 'kg';
          const precio = esPerfil ? ref.fila.precio
            : (ref && ref.fila.precio !== undefined ? ref.fila.precio : c.precio_unitario);
          if (typeof precio !== 'number') sinPrecio.add(esPerfil ? `el perfil ${refId} no tiene precio` : 'ni la Ref ni la columna Precio unitario dan precio');
        });
        for (const t of sinPrecio) aviso('componentes', i, 'precio_unitario', 'precio', `${c.id} ${c.nombre || ''}: sin precio (${t}); saldrá sin importe`);
      }
    });

    // Obra local
    (cat.obra_local || []).forEach((z, i) => {
      for (const k of ['movilizacion', 'montaje', 'hoyos_y_dados']) {
        if (vacio(z[k])) aviso('obra_local', i, k, 'precio', `Zona ${z.zona}: ${(meta.obra_local && meta.obra_local.titulos[k]) || k} vacío, se toma 0`);
      }
    });

    // Prueba final: el motor debe calcular cada modelo sin errores ni totales no numéricos
    if (!errores.length) {
      const zona = (cat.obra_local || [])[0];
      modelos.forEach((m, i) => {
        try {
          const r = MOTOR.calcular(cat, { modelo: m.id, naves: 3, tramos: 10, puertas: 1, zona: zona && zona.zona });
          for (const a of r.avisos.filter(a => a.codigo === 'error')) error('modelos', i, null, 'calculo', `Modelo ${m.id}: ${a.texto}`);
          if (!Number.isFinite(r.precio.total)) error('modelos', i, null, 'calculo', `Modelo ${m.id}: el cálculo de prueba da un total no numérico`);
        } catch (e) {
          error('modelos', i, null, 'calculo', `Modelo ${m.id}: el cálculo de prueba falla (${e.message})`);
        }
      });
    }

    return { errores, avisos };
  }

  const API = { importar, validar, clave, aNumero, HOJAS };
  raiz.IMPORTADOR = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
