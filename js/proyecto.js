// ============================================================
// Guardar y abrir proyecto (.json)
// ============================================================
// El archivo guarda todo lo introducido en la pantalla y la identidad del
// catálogo con el que se calculó (nombre, versión, fecha y una huella del
// contenido). No guarda el catálogo: es del distribuidor y puede ser grande.
//
//   const archivo = PROYECTO.serializar(estado, catalogo, origenCatalogo)
//   const { estado, errores, avisos } = PROYECTO.leer(archivoOTexto, catalogoActual)
//   errores → no se puede abrir; avisos → se abre, pero conviene revisarlo

(function (raiz) {
  const FORMATO = 'configurador-invernaderos/proyecto';
  const VERSION = 1;

  // Campos del estado de la pantalla que se guardan (y su tipo)
  const CAMPOS = {
    modelo: 'texto', naves: 'numero', tramos: 'numero', altura_canal: 'numeroONulo',
    ancho_nave: 'numeroONulo', separacion: 'numeroONulo', puertas: 'numero',
    seleccion: 'objeto', opcionales: 'lista', zona: 'texto', viento_kmh: 'numeroOVacio',
    parcela: 'objeto', cliente: 'texto', ubicacion: 'texto', codigoProyecto: 'texto', vistaActual: 'texto',
    // Fase 6: parcela del Catastro (polígono en metros e implantación elegida), retranqueos y perfil
    terreno: 'terreno', retranqueo: 'numero', camino: 'numero', perfil: 'texto'
  };
  // Polígono: anillos de puntos [x, y] numéricos, el exterior con 3 o más
  const esPunto = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const esTerreno = (v) => v === null || (v !== null && typeof v === 'object' && Array.isArray(v.anillos) && v.anillos.length > 0
    && v.anillos.every(a => Array.isArray(a) && a.length >= 3 && a.every(esPunto))
    && (v.implantacion == null || ['cx', 'cy', 'azimut', 'largo', 'ancho'].every(k => Number.isFinite(v.implantacion[k]))));

  // Huella del catálogo: FNV-1a de 32 bits sobre su JSON. Cambia con cualquier
  // cambio de contenido, aunque se mantengan el nombre y la versión.
  function huella(catalogo) {
    const texto = JSON.stringify(catalogo);
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function identidadCatalogo(catalogo, origen) {
    const e = (catalogo && catalogo.empresa) || {};
    return {
      nombre: e.nombre || '', version: e.version_catalogo || '', fecha: e.fecha || '',
      archivo: origen && origen.archivo ? origen.archivo : '(catálogo de ejemplo)',
      huella: huella(catalogo)
    };
  }

  function serializar(estado, catalogo, origenCatalogo) {
    const datos = {};
    for (const k of Object.keys(CAMPOS)) {
      const v = estado[k];
      datos[k] = v instanceof Set ? [...v] : (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
    }
    return {
      formato: FORMATO, version: VERSION, guardado: new Date().toISOString(),
      catalogo: identidadCatalogo(catalogo, origenCatalogo),
      proyecto: datos
    };
  }

  const describir = (c) => `«${c.nombre || 'sin nombre'}»${c.version ? ` versión ${c.version}` : ''}${c.fecha ? ` (${c.fecha})` : ''}`;

  function leer(entrada, catalogoActual, origenActual) {
    const errores = [], avisos = [];
    let obj = entrada;
    if (typeof entrada === 'string') {
      try { obj = JSON.parse(entrada); } catch (e) { return { estado: null, errores: ['El archivo no es un JSON válido.'], avisos }; }
    }
    if (!obj || obj.formato !== FORMATO) return { estado: null, errores: ['El archivo no es un proyecto del configurador.'], avisos };
    if (typeof obj.version !== 'number' || obj.version > VERSION) {
      return { estado: null, errores: [`Proyecto guardado con una versión más nueva del configurador (${obj.version}); actualiza la herramienta.`], avisos };
    }
    const p = obj.proyecto || {};

    // Tipos
    const estado = {};
    for (const [k, tipo] of Object.entries(CAMPOS)) {
      const v = p[k];
      const ok = {
        texto: typeof v === 'string',
        numero: typeof v === 'number' && Number.isFinite(v),
        numeroONulo: v === null || (typeof v === 'number' && Number.isFinite(v)),
        numeroOVacio: v === '' || (typeof v === 'number' && Number.isFinite(v)),
        objeto: v !== null && typeof v === 'object' && !Array.isArray(v),
        lista: Array.isArray(v),
        terreno: esTerreno(v)
      }[tipo];
      if (v === undefined) continue; // campo ausente: se queda el valor por defecto
      if (!ok) { errores.push(`Dato «${k}» con un valor no válido.`); continue; }
      estado[k] = tipo === 'lista' ? v.slice() : ((tipo === 'objeto' || tipo === 'terreno') && v ? JSON.parse(JSON.stringify(v)) : v);
    }
    if (errores.length) return { estado: null, errores, avisos };

    // Catálogo: ¿el mismo con el que se guardó?
    const guardado = obj.catalogo || {};
    const actual = identidadCatalogo(catalogoActual, origenActual);
    let mismoCatalogo = guardado.huella === actual.huella;
    if (!mismoCatalogo) {
      const mismaVersion = guardado.nombre === actual.nombre && guardado.version === actual.version;
      avisos.push(`El proyecto se guardó con el catálogo ${describir(guardado)} y ahora está cargado ${describir(actual)}`
        + (mismaVersion ? ', con el mismo nombre y versión pero contenido distinto' : '')
        + '. Medidas, cantidades y precios pueden cambiar: carga el catálogo original para reproducir la oferta.');
    }

    // El modelo tiene que existir en el catálogo cargado
    const modelos = (catalogoActual && catalogoActual.modelos) || [];
    if (estado.modelo && !modelos.some(m => m.id === estado.modelo)) {
      errores.push(`El modelo «${estado.modelo}» no está en el catálogo cargado. Carga el catálogo ${describir(guardado)} y vuelve a abrir el proyecto.`);
      return { estado: null, errores, avisos, mismoCatalogo };
    }
    // Opciones que ya no existen: se descartan con aviso
    const ids = new Set(((catalogoActual && catalogoActual.componentes) || []).map(c => c.id));
    for (const [g, id] of Object.entries(estado.seleccion || {})) {
      if (id !== null && !ids.has(id)) { avisos.push(`La opción «${id}» (${g}) ya no está en el catálogo: se usa la de por defecto.`); delete estado.seleccion[g]; }
    }
    if (estado.opcionales) {
      const fuera = estado.opcionales.filter(id => !ids.has(id));
      if (fuera.length) avisos.push(`Opcionales que ya no están en el catálogo: ${fuera.join(', ')}.`);
      estado.opcionales = estado.opcionales.filter(id => ids.has(id));
    }
    if (estado.zona && !((catalogoActual && catalogoActual.obra_local) || []).some(z => z.zona === estado.zona)) {
      avisos.push(`La zona de obra local «${estado.zona}» no está en el catálogo: se calcula sin obra local.`);
      estado.zona = '';
    }
    return { estado, errores, avisos, mismoCatalogo, catalogoGuardado: guardado };
  }

  const API = { serializar, leer, huella, identidadCatalogo, FORMATO, VERSION, CAMPOS };
  raiz.PROYECTO = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
