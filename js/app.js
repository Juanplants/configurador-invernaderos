// ============================================================
// Configurador de Invernaderos — orquestador principal
// ============================================================
// v0.4: la interfaz de la v0.3 conectada al motor de cálculo
// (js/motor/). Todos los datos de producto salen del catálogo;
// aquí solo hay estado de la pantalla y pintado.

// Catálogo activo: el cargado con «Cargar catálogo» en esta sesión o, si no
// hay ninguno, el de ejemplo (datos/catalogo-ejemplo.js)
let CATALOGO = window.CATALOGO_EJEMPLO;
let catalogoImportado = null;   // { archivo, fecha } cuando viene de un Excel
const CLAVE_SESION = 'configurador.catalogo';
const lista = MOTOR.geometria.lista;

const state = {
  modelo: CATALOGO.modelos[0].id,
  naves: 3,
  tramos: 11,
  // null = primera de la lista del catálogo (el distribuidor ordena la lista
  // para que su medida habitual vaya delante)
  altura_canal: null,
  ancho_nave: null,
  separacion: null,
  puertas: 1,
  seleccion: {},        // grupo de alternativas → id de componente, o null = ninguna
  opcionales: new Set(),
  zona: (CATALOGO.obra_local || [])[0]?.zona || '',
  viento_kmh: '',
  nieve_kgm2: '',
  // Sitio: municipio (código INE) del que salen viento y nieve (CTE DB SE-AE), salvo
  // que se escriban a mano; categoría de terreno y pendiente (%)
  sitio: { municipio: null, categoria: 'II', pendiente: '', viento_manual: false, nieve_manual: false },
  parcela: { largo: '', ancho: '', orientacion: 0, girado: false },
  // Fase 6: parcela del Catastro { anillos, meta, implantacion } o null; retranqueos (m) y perfil del optimizador
  terreno: null,
  retranqueo: 3,
  camino: 4,
  perfil: 'equilibrado',
  orientacion_preferida: 'norte_sur',   // cumbrera: 'norte_sur' | 'este_oeste' | 'indiferente'
  cliente: '',
  ubicacion: '',
  codigoProyecto: '',
  vistaActual: 'planta',
  verCalculo: false,
  pasos: PASOS.inicial(),   // paso actual y visitados (no se guarda en el proyecto)
  optimizacion: null    // última búsqueda del optimizador (no se guarda)
};

// ------- Catálogo: cargar, validar, guardar en la sesión -------
function aplicarCatalogo(catalogo, origen) {
  CATALOGO = catalogo;
  catalogoImportado = origen;
  state.modelo = catalogo.modelos[0].id;
  state.altura_canal = state.ancho_nave = state.separacion = null;
  state.seleccion = {};
  state.opcionales.clear();
  state.zona = (catalogo.obra_local || [])[0]?.zona || '';
  state.optimizacion = null; // las candidatas eran de otro catálogo
  // Las listas de modelos y zonas se rellenan de nuevo en el siguiente render
  document.getElementById('model-select').innerHTML = '';
  document.getElementById('zona').innerHTML = '';
  const emp = catalogo.empresa || {};
  document.getElementById('catalogo-nombre').textContent = origen
    ? `Catálogo: ${emp.nombre || 'sin nombre'} · ${origen.archivo}`
    : `Catálogo de ejemplo: ${emp.nombre || ''} (valores estimados)`;
  document.getElementById('btn-catalogo-ejemplo').hidden = !origen;
}

// sessionStorage: dura mientras la pestaña esté abierta; no hay servidor.
// Se vuelve a validar al recuperarlo por si el guardado es de otra versión.
function catalogoDeSesion() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
    if (guardado && guardado.catalogo && IMPORTADOR.validar(guardado.catalogo).errores.length === 0) return guardado;
  } catch (_) { /* sin sesión o dato corrupto: se usa el de ejemplo */ }
  return null;
}
function guardarEnSesion(catalogo, origen) {
  try {
    if (catalogo) sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ catalogo, origen }));
    else sessionStorage.removeItem(CLAVE_SESION);
    return true;
  } catch (_) {
    return false;
  }
}

function cargarArchivoCatalogo(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    const r = IMPORTADOR.importar(XLSX, new Uint8Array(lector.result));
    let guardado = true;
    if (!r.errores.length) {
      const origen = { archivo: archivo.name, fecha: new Date().toLocaleString('es-ES') };
      aplicarCatalogo(r.catalogo, origen);
      guardado = guardarEnSesion(r.catalogo, origen);
      render();
    }
    mostrarResultadoCatalogo(archivo.name, r, guardado);
  };
  lector.onerror = () => mostrarResultadoCatalogo(archivo.name,
    { errores: [{ texto: 'No se pudo leer el archivo' }], avisos: [] }, true);
  lector.readAsArrayBuffer(archivo);
}

function tablaIncidencias(lista_) {
  return `<table class="tabla-incidencias">
    <tr><th>Hoja</th><th class="n">Fila</th><th>Columna</th><th>Qué falla</th></tr>
    ${lista_.map(x => `<tr><td>${esc(x.hoja || '—')}</td><td class="n">${x.fila ?? ''}</td><td>${esc(x.columna || '')}</td><td>${esc(x.texto)}</td></tr>`).join('')}
  </table>`;
}

// ------- Guardar y abrir proyecto (.json) -------
function descargarArchivo(contenido, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function guardarProyecto() {
  const archivo = PROYECTO.serializar(state, CATALOGO, catalogoImportado);
  descargarArchivo(JSON.stringify(archivo, null, 2), EXPORTAR.nombreArchivo(state.codigoProyecto, 'proyecto', new Date(), 'json'), 'application/json');
}

// Pone en pantalla un estado leído de archivo (el catálogo no cambia)
function aplicarEstadoProyecto(e) {
  aplicarCatalogo(CATALOGO, catalogoImportado); // valores por defecto del catálogo actual
  state.sitio = sitioPorDefecto();
  for (const [k, v] of Object.entries(e)) {
    if (k === 'opcionales') state.opcionales = new Set(v);
    else if (k === 'sitio') state.sitio = Object.assign(sitioPorDefecto(), v);
    else if (k === 'parcela') state.parcela = Object.assign({ largo: '', ancho: '', orientacion: 0, girado: false }, v);
    else state[k] = v;
  }
  depurarSeleccion();
  // Campos de texto que render() no reescribe
  const poner = (id, v) => { document.getElementById(id).value = v ?? ''; };
  poner('cliente', state.cliente); poner('ubicacion', state.ubicacion); poner('codigo-proyecto', state.codigoProyecto);
  // Proyecto sin municipio (anterior a la tabla): el viento y la nieve son manuales
  if (!e.sitio) state.sitio.viento_manual = state.sitio.nieve_manual = true;
  poner('viento', state.viento_kmh); poner('nieve', state.nieve_kgm2); poner('pendiente', state.sitio.pendiente);
  poner('retranqueo', state.retranqueo); poner('camino', state.camino);
  if (!OPTIMIZADOR.ORIENTACIONES[state.orientacion_preferida]) state.orientacion_preferida = OPTIMIZADOR.ORIENTACION_PREFERIDA;
  state.optimizacion = null;
  poner('parcela-largo', state.parcela.largo); poner('parcela-ancho', state.parcela.ancho); poner('parcela-orientacion', state.parcela.orientacion);
  document.getElementById('parcela-girado').checked = !!state.parcela.girado;
  if (!PLANOS_VISTAS[state.vistaActual]) state.vistaActual = 'planta';
  state.pasos = PASOS.todos(state.pasos); // un proyecto abierto está completo: se puede ir a cualquier paso
  render();
}

function abrirProyecto(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    const r = PROYECTO.leer(String(lector.result), CATALOGO, catalogoImportado);
    if (!r.errores.length) aplicarEstadoProyecto(r.estado);
    const lista = (xs) => `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    document.getElementById('dialogo-catalogo-contenido').innerHTML = r.errores.length
      ? `<h3 class="mal">✗ El proyecto no se ha abierto</h3><p><strong>${esc(archivo.name)}</strong></p>${lista(r.errores)}${r.avisos.length ? `<h4>Avisos</h4>${lista(r.avisos)}` : ''}`
      : `<h3 class="bien">✓ Proyecto abierto</h3><p><strong>${esc(archivo.name)}</strong>${state.cliente ? ` · ${esc(state.cliente)}` : ''}${state.codigoProyecto ? ` · ${esc(state.codigoProyecto)}` : ''}</p>`
        + (r.avisos.length ? `<h4>${r.avisos.length === 1 ? 'Aviso' : 'Avisos'}</h4><div class="avisos-proyecto">${r.avisos.map(a => `<div class="aviso ambar">${esc(a)}</div>`).join('')}</div>` : '<p class="hint">Calculado con el mismo catálogo con el que se guardó.</p>');
    document.body.classList.add('dialogo-abierto');
  };
  lector.readAsText(archivo);
}

function mostrarResultadoCatalogo(nombreArchivo, r, guardado) {
  const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
  let html;
  if (r.errores.length) {
    html = `
      <h3 class="mal">✗ El catálogo no se ha cargado</h3>
      <p><strong>${esc(nombreArchivo)}</strong> tiene ${n(r.errores.length, 'error', 'errores')}.
      Corrígelos en el Excel y vuelve a cargarlo. Mientras tanto se sigue usando el catálogo anterior.</p>
      ${tablaIncidencias(r.errores)}`;
  } else {
    const c = r.catalogo;
    html = `
      <h3 class="bien">✓ Catálogo cargado</h3>
      <p><strong>${esc(nombreArchivo)}</strong> · ${esc(c.empresa.nombre || 'sin nombre de empresa')}:
      ${n(c.modelos.length, 'modelo', 'modelos')}, ${n(c.componentes.length, 'componente', 'componentes')},
      ${n(c.perfiles.length, 'perfil', 'perfiles')}, ${n((c.obra_local || []).length, 'zona', 'zonas')} de obra local.</p>
      <p class="hint">${guardado
        ? 'Queda guardado en esta sesión del navegador: se mantiene al recargar la página y se olvida al cerrar la pestaña.'
        : 'El navegador no permite guardarlo en la sesión: al recargar la página habrá que cargarlo otra vez.'}</p>`;
  }
  if (r.avisos.length) {
    html += `<h4>${n(r.avisos.length, 'aviso', 'avisos')} (no impiden cargar)</h4>${tablaIncidencias(r.avisos)}`;
  }
  document.getElementById('dialogo-catalogo-contenido').innerHTML = html;
  document.body.classList.add('dialogo-abierto');
}

// ------- Helpers -------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtEuro = n => (n ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
const fmtNum = (n, d = 1) => (n ?? 0).toLocaleString('es-ES', { maximumFractionDigits: d });

function getModelo() { return CATALOGO.modelos.find(m => m.id === state.modelo); }

function componentesDelModelo(modelo) {
  return CATALOGO.componentes.filter(c =>
    String(c.modelos || '').split(';').map(s => s.trim()).includes(modelo.id));
}

// Valor elegido si el modelo lo admite; si no, el primero admitido
function admitido(valor, admitidos) {
  const vals = lista(admitidos);
  return vals.some(v => Math.abs(v - valor) < 1e-6) ? valor : vals[0];
}

function proyecto() {
  const modelo = getModelo();
  return {
    modelo: modelo.id,
    naves: state.naves,
    tramos: state.tramos,
    altura_canal: admitido(state.altura_canal, modelo.alturas_a_canal_admitidas),
    ancho_nave: admitido(state.ancho_nave, modelo.anchos_de_nave_admitidos),
    separacion: admitido(state.separacion, modelo.separaciones_entre_porticos),
    puertas: state.puertas,
    seleccion: state.seleccion,
    opcionales: [...state.opcionales],
    zona: state.zona || undefined,
    sitio: sitioProyecto()
  };
}

// ------- Sitio: viento y nieve (CTE DB SE-AE) -------
// Zona eólica (fig. D.1) y zona de clima invernal (fig. E.2) las elige el usuario,
// con la altitud; atajo: capitales de la tabla 3.8. Datos en datos/municipios.js.
const DATOS_SITIO = window.SITIO_DATOS || { normativa: null, municipios: { filas: [] } };
const NORMATIVA = DATOS_SITIO.normativa;
// Tabla de municipios opcional: vacía, no se muestra
const MUNICIPIOS = SITIO.indice(SITIO.desempaquetar(DATOS_SITIO));
const sitioPorDefecto = () => ({ zona_eolica: '', zona_invierno: '', altitud: '', capital: '', municipio: null, categoria: 'II', pendiente: '', viento_manual: false, nieve_manual: false });

function municipioActual() {
  return state.sitio.municipio ? MUNICIPIOS.porIne.get(state.sitio.municipio) || null : null;
}
function cargasSitio(altura = 10) {
  return NORMATIVA ? SITIO.cargas(NORMATIVA, state.sitio, { categoria: state.sitio.categoria, altura }) : { viento: null, nieve: null };
}
// Viento y nieve del CTE, salvo los escritos a mano
function aplicarCargasSitio() {
  const c = cargasSitio();
  if (!state.sitio.viento_manual) state.viento_kmh = c.viento ? Math.round(c.viento.kmh * 10) / 10 : '';
  if (!state.sitio.nieve_manual) state.nieve_kgm2 = c.nieve && !c.nieve.fuera ? Math.round(c.nieve.kgm2) : '';
}
function nieveFueraDeTabla() {
  if (state.sitio.nieve_manual) return null;
  const c = cargasSitio();
  return c.nieve && c.nieve.fuera ? c.nieve : null;
}
function sitioProyecto() {
  const s = {};
  if (state.viento_kmh !== '') s.viento_kmh = +state.viento_kmh;
  if (state.nieve_kgm2 !== '') s.nieve = +state.nieve_kgm2;
  const fuera = nieveFueraDeTabla();
  if (fuera) s.nieve_fuera = { zona: fuera.zona, altitud: fuera.altitud, ultima: fuera.ultima };
  return Object.keys(s).length ? s : undefined;
}
// Un municipio de la tabla (si la hay) rellena zonas y altitud
function elegirMunicipio(m) {
  Object.assign(state.sitio, { municipio: m.ine, zona_eolica: m.zona_eolica, zona_invierno: m.zona_invierno, altitud: m.altitud, capital: '', viento_manual: false, nieve_manual: false });
  document.getElementById('altitud').value = m.altitud;
}
// De dónde sale cada valor: 'zona' (viento del CTE), 'capital' / 'tabla' (nieve del CTE) o 'manual'
function origenCarga(tipo) {
  const valor = tipo === 'viento' ? state.viento_kmh : state.nieve_kgm2;
  if (valor === '') return '';
  if (tipo === 'viento') return state.sitio.viento_manual ? 'manual' : 'zona';
  return state.sitio.nieve_manual ? 'manual' : (state.sitio.capital ? 'capital' : 'tabla');
}
// Todo lo del sitio en un objeto (propuesta)
function infoSitio(r) {
  const c = cargasSitio(r.geometria.altura_cumbrera);
  const cat = NORMATIVA && NORMATIVA.categorias_terreno[state.sitio.categoria];
  return {
    zona_eolica: state.sitio.zona_eolica, zona_invierno: state.sitio.zona_invierno, altitud: state.sitio.altitud, capital: state.sitio.capital,
    municipio: municipioActual(), cargas: c, fuera: nieveFueraDeTabla(), categoria: cat ? cat.nombre : state.sitio.categoria, pendiente: state.sitio.pendiente,
    viento_kmh: state.viento_kmh, nieve_kgm2: state.nieve_kgm2, origen_viento: origenCarga('viento'), origen_nieve: origenCarga('nieve'),
    fuente: NORMATIVA ? NORMATIVA.fuente : ''
  };
}

function renderSitio({ r }) {
  const f = (v, d = 2) => fmtNum(v, d);
  // No se reescribe el campo en el que se está escribiendo (los desplegables, siempre)
  const poner = (id, v) => { const el = document.getElementById(id); if (document.activeElement !== el || el.tagName === 'SELECT') el.value = v ?? ''; };
  const opciones = (id, lista) => { const el = document.getElementById(id); if (!el.options.length) el.innerHTML = lista; };
  if (NORMATIVA) {
    opciones('zona-eolica', '<option value="">—</option>' + SITIO.ZONAS_EOLICAS.map(z => `<option value="${z}">${z} (${NORMATIVA.viento.zonas[z].vb} m/s)</option>`).join(''));
    opciones('zona-invierno', '<option value="">—</option>' + SITIO.ZONAS_INVIERNO.map(z => `<option value="${z}">${z}</option>`).join(''));
    opciones('capital-cte', '<option value="">— (zona invernal y altitud)</option>' + NORMATIVA.capitales.lista.map(c => `<option value="${esc(c.nombre)}">${esc(c.nombre)} (${c.altitud} m, ${f(c.sk, 1)} kN/m²)</option>`).join(''));
  }
  const st = state.sitio;
  poner('zona-eolica', st.zona_eolica); poner('zona-invierno', st.zona_invierno); poner('capital-cte', st.capital); poner('altitud', st.altitud);
  document.getElementById('zona-invierno').disabled = !!st.capital;
  // Municipio: solo si hay tabla (vacía no estorba)
  const hayTabla = MUNICIPIOS.lista.length > 0;
  document.getElementById('campo-municipio').hidden = !hayTabla;
  const entrada = document.getElementById('municipio');
  if (hayTabla) {
    const lista = document.getElementById('lista-municipios');
    if (!lista.options.length) lista.innerHTML = MUNICIPIOS.lista.map(m => `<option value="${esc(m.etiqueta)}"></option>`).join('');
    const m = municipioActual();
    if (document.activeElement !== entrada && !entrada.dataset.noEncontrado) entrada.value = m ? m.etiqueta : '';
  }
  // Datos del CTE para lo elegido
  const c = r ? cargasSitio(r.geometria.altura_cumbrera) : cargasSitio();
  const lineas = [];
  if (entrada.dataset.noEncontrado) lineas.push(`<div class="aviso ambar">«${esc(entrada.dataset.noEncontrado)}» no está en la tabla de municipios: elige uno de la lista.</div>`);
  if (c.viento) lineas.push(`<div>Zona eólica <strong>${esc(c.viento.zona)}</strong>: v<sub>b</sub> ${f(c.viento.vb, 0)} m/s (${f(c.viento.kmh, 1)} km/h), q<sub>b</sub> ${f(c.viento.qb)} kN/m²${c.viento.ce !== null && r ? ` · c<sub>e</sub> ${f(c.viento.ce)} a ${f(c.viento.altura, 1)} m (cumbrera) → q<sub>e</sub> ${f(c.viento.qe)} kN/m²` : ''}</div>`);
  if (c.nieve && c.nieve.origen === 'capital') lineas.push(`<div>${esc(c.nieve.nombre)} (tabla 3.8): altitud ${f(c.nieve.altitud, 0)} m → s<sub>k</sub> ${f(c.nieve.sk, 1)} kN/m² (${f(c.nieve.kgm2, 0)} kg/m²)</div>`);
  else if (c.nieve && c.nieve.fuera) lineas.push(`<div class="rojo">Nieve: zona ${c.nieve.zona} a ${f(c.nieve.altitud, 0)} m, <strong>fuera de tabla, requiere estudio</strong> (la tabla E.2 llega a ${f(c.nieve.ultima, 0)} m en esta zona).</div>`);
  else if (c.nieve) lineas.push(`<div>Zona de invierno <strong>${c.nieve.zona}</strong> · altitud ${f(c.nieve.altitud, 0)} m → s<sub>k</sub> ${f(c.nieve.sk)} kN/m² (${f(c.nieve.kgm2, 0)} kg/m², tabla E.2)</div>`);
  document.getElementById('sitio-info').innerHTML = lineas.length ? `<div class="municipio-datos">${lineas.join('')}</div>` : '';
  poner('viento', state.viento_kmh);
  poner('nieve', state.nieve_kgm2);
  const etiqueta = { zona: 'CTE', capital: 'CTE, tabla 3.8', tabla: 'CTE, tabla E.2', manual: 'manual' };
  for (const t of ['viento', 'nieve']) {
    const o = origenCarga(t), el = document.getElementById(`${t}-origen`);
    el.textContent = etiqueta[o] || '';
    el.className = `origen origen-${o === 'manual' ? 'manual' : o ? 'municipio' : 'vacio'}`;
  }
  const hayCte = !!(c.viento || c.nieve);
  document.getElementById('btn-cargas-municipio').hidden = !(hayCte && (st.viento_manual || st.nieve_manual));
  const cat = document.getElementById('categoria-terreno');
  const cats = NORMATIVA ? SITIO.CATEGORIAS.map(k => [k, NORMATIVA.categorias_terreno[k]]) : [];
  if (!cat.options.length) cat.innerHTML = cats.map(([k, d]) => `<option value="${k}">${esc(d.nombre)}</option>`).join('');
  cat.value = st.categoria;
  const d = NORMATIVA && NORMATIVA.categorias_terreno[st.categoria];
  document.getElementById('categoria-explicacion').textContent = d ? d.explicacion : '';
  poner('pendiente', st.pendiente);
}

function calcularTodo() {
  const modelo = getModelo();
  try {
    return { modelo, r: MOTOR.calcular(CATALOGO, proyecto()) };
  } catch (e) {
    return { modelo, error: e.message };
  }
}

// Al cambiar de modelo, olvida las elecciones que el nuevo modelo no tiene
// (el motor usaría «ninguna» en silencio) y vuelve a su alternativa por defecto.
function depurarSeleccion() {
  const comps = componentesDelModelo(getModelo());
  for (const [g, id] of Object.entries(state.seleccion)) {
    if (id !== null && !comps.some(c => c.id === id && c.grupo_alternativas === g)) delete state.seleccion[g];
  }
  for (const id of state.opcionales) {
    if (!comps.some(c => c.id === id)) state.opcionales.delete(id);
  }
}

// Perfiles de acero que usa el proyecto (para rótulos de planos y propuesta)
function perfilesUsados(r) {
  const vistos = new Map();
  for (const l of r.lineas) {
    const p = (CATALOGO.perfiles || []).find(x => x.id === l.ref);
    if (p && !vistos.has(p.id)) vistos.set(p.id, p);
  }
  return [...vistos.values()];
}

// ------- Pasos -------
// Solo se ve el paso actual; la barra deja saltar a los ya visitados
function renderPasos() {
  const p = state.pasos;
  document.querySelectorAll('.paso').forEach(sec => { sec.hidden = sec.dataset.paso !== p.actual; });
  document.querySelectorAll('.paso-boton').forEach(b => {
    const paso = b.dataset.ir;
    b.classList.toggle('actual', paso === p.actual);
    b.classList.toggle('visitado', PASOS.visitado(p, paso));
    b.disabled = !PASOS.visitado(p, paso);
    b.setAttribute('aria-current', paso === p.actual ? 'step' : 'false');
  });
  const i = PASOS.indice(p), n = PASOS.LISTA.length;
  document.getElementById('btn-anterior').disabled = i === 0;
  const sig = document.getElementById('btn-siguiente');
  sig.hidden = i === n - 1;
  if (i < n - 1) sig.textContent = `Siguiente: ${PASOS.NOMBRES[PASOS.LISTA[i + 1]]} →`;
  document.getElementById('paso-actual').textContent = `Paso ${i + 1} de ${n}`;
}

// Resumen de una línea encima de cada paso: lo esencial sin ir a «Revisión»
function renderResumenCorto({ modelo, r, error }) {
  const caja = document.getElementById('resumen-corto');
  const marca = document.getElementById('marca-avisos');
  if (error) { caja.innerHTML = `<span class="rojo">${esc(error)}</span>`; marca.textContent = '!'; marca.className = 'marca-avisos rojo'; return; }
  const g = r.geometria, p = r.precio;
  const rojos = r.avisos.filter(a => a.nivel === 'rojo').length + (avisoParcela(r) ? 1 : 0);
  const ambar = r.avisos.filter(a => a.nivel === 'ambar').length;
  caja.innerHTML = `<strong>${esc(modelo.nombre)}</strong> · ${g.naves} × ${fmtNum(g.ancho_nave, 2)} m × ${fmtNum(g.largo)} m · ${fmtNum(g.area, 0)} m²`
    + ` · <strong>${fmtNum(p.eur_m2, 2)} €/m²</strong> · ${fmtEuro(p.total)} IVA incl.`
    + (rojos || ambar ? ` · <span class="${rojos ? 'rojo' : 'ambar'}">${rojos + ambar} aviso${rojos + ambar > 1 ? 's' : ''} (ver «Revisión»)</span>` : '');
  marca.textContent = rojos + ambar ? String(rojos + ambar) : '';
  marca.className = `marca-avisos ${rojos ? 'rojo' : ambar ? 'ambar' : ''}`;
}

// Emplazamiento: aptitud de cada modelo del catálogo para el viento y la nieve del sitio
function renderAptitud() {
  const caja = document.getElementById('aptitud-modelos');
  const sitio = sitioProyecto();
  if (!sitio) { caja.innerHTML = '<p class="hint">Con el viento y la nieve del sitio se comprueba cada modelo (apto / al límite / no apto, margen 10 %) antes de diseñar.</p>'; return; }
  const texto = { apto: 'Apto', al_limite: 'Al límite', no_apto: 'No apto — requiere cálculo' };
  caja.innerHTML = `<table class="tabla-aptitud">
    <tr><th>Modelo (declarado)</th><th>Viento</th><th>Nieve</th><th>Resultado</th></tr>
    ${CATALOGO.modelos.map(m => {
      const e = MOTOR.avisos.emplazamiento(m, sitio);
      const parte = (v) => v === 'sin_dato' ? '<span class="ambar">sin dato</span>' : v === 'fuera_tabla' ? '<span class="rojo">fuera de tabla, requiere estudio</span>' : texto[v].replace(' — requiere cálculo', '');
      return `<tr><td>${esc(m.nombre)} <small>(${m.viento_cerrado ?? '—'} km/h · ${m.nieve > 0 ? `${m.nieve} kg/m²` : 'nieve sin declarar'})</small></td>
        <td class="apto-${e.viento}">${parte(e.viento)}</td><td class="apto-${e.nieve}">${sitio.nieve || sitio.nieve_fuera ? parte(e.nieve) : '—'}</td><td class="apto-${e.resultado}">${texto[e.resultado]}</td></tr>`;
    }).join('')}</table>`;
}

// ------- Render -------
function render() {
  aplicarCargasSitio();
  const datos = calcularTodo();
  renderPasos();
  renderConfigPanel(datos);
  renderResumenCorto(datos);
  renderSitio(datos);
  if (datos.error) {
    document.getElementById('summary').innerHTML = `<div class="aviso rojo">${esc(datos.error)}</div>`;
    document.getElementById('materiales').innerHTML = '';
    document.getElementById('plan').innerHTML = '';
    return;
  }
  renderSummary(datos);
  renderMateriales(datos);
  renderPlano(datos);
}

function opcionesSelect(valores, actual) {
  return valores.map(v => `<option value="${v}" ${Math.abs(v - actual) < 1e-6 ? 'selected' : ''}>${fmtNum(v, 2)} m</option>`).join('');
}

function renderConfigPanel({ modelo }) {
  const modelSelect = document.getElementById('model-select');
  if (modelSelect.options.length === 0) {
    modelSelect.innerHTML = CATALOGO.modelos.map(m => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join('');
  }
  modelSelect.value = state.modelo;
  document.getElementById('model-description').textContent = modelo.descripcion || '';
  document.getElementById('num-naves').value = state.naves;
  document.getElementById('num-tramos').value = state.tramos;
  document.getElementById('puertas').value = state.puertas;

  const p = proyecto();
  for (const [id, campo, actual] of [
    ['ancho-nave', 'anchos_de_nave_admitidos', p.ancho_nave],
    ['separacion', 'separaciones_entre_porticos', p.separacion],
    ['altura-canal', 'alturas_a_canal_admitidas', p.altura_canal]
  ]) {
    const sel = document.getElementById(id);
    const vals = lista(modelo[campo]);
    sel.innerHTML = opcionesSelect(vals, actual);
    sel.disabled = vals.length < 2;
  }

  const zonaSelect = document.getElementById('zona');
  if (zonaSelect.options.length === 0) {
    zonaSelect.innerHTML = (CATALOGO.obra_local || []).map(z => `<option value="${esc(z.zona)}">${esc(z.zona)}</option>`).join('')
      + '<option value="">Sin obra local (solo materiales)</option>';
  }
  zonaSelect.value = state.zona;

  const perfilSelect = document.getElementById('perfil');
  if (perfilSelect.options.length === 0) {
    perfilSelect.innerHTML = Object.entries(OPTIMIZADOR.PERFILES).map(([k, p]) => `<option value="${k}">${esc(p.nombre)}</option>`).join('');
  }
  perfilSelect.value = OPTIMIZADOR.PERFILES[state.perfil] ? state.perfil : 'equilibrado';
  renderAptitud();
  const orientSelect = document.getElementById('orientacion-preferida');
  if (orientSelect.options.length === 0) {
    orientSelect.innerHTML = Object.entries(OPTIMIZADOR.ORIENTACIONES).map(([k, o]) => `<option value="${k}">${esc(o.nombre)}</option>`).join('');
  }
  orientSelect.value = state.orientacion_preferida;
  mostrarParcela();
  renderOptimizador();

  renderEnvolvente(modelo);
}

// Nombre común de las alternativas de un grupo ("Ventana cenital una hoja" /
// "Ventana cenital mariposa" → "Ventana cenital")
function etiquetaGrupo(comps) {
  const palabras = comps.map(c => c.nombre.split(' '));
  const comun = [];
  for (let i = 0; palabras.every(p => i < p.length - 1 && p[i] === palabras[0][i]); i++) comun.push(palabras[0][i]);
  return comun.length ? comun.join(' ') : comps.map(c => c.nombre).join(' / ');
}

// Opciones de envolvente generadas desde el catálogo: una lista por grupo de
// alternativas (con «Ninguna» si todas son opcionales) y casillas para los
// opcionales sueltos y los grupos de una sola alternativa opcional.
function renderEnvolvente(modelo) {
  const comps = componentesDelModelo(modelo);
  const { grupos } = MOTOR.materiales.componentesActivos(CATALOGO, modelo, { seleccion: state.seleccion });
  const porCategoria = new Map();
  const añadir = (cat, html) => { if (!porCategoria.has(cat)) porCategoria.set(cat, []); porCategoria.get(cat).push(html); };
  const hechos = new Set();

  for (const c of comps) {
    const g = c.grupo_alternativas;
    if (g && !hechos.has(g)) {
      hechos.add(g);
      const alternativas = grupos[g];
      const puedeNinguna = alternativas.every(a => a.tipo === 'opcional');
      const actual = g in state.seleccion ? state.seleccion[g] : alternativas[0].id;
      if (alternativas.length === 1 && puedeNinguna) {
        añadir(c.categoria, `
          <label class="opt">
            <input type="checkbox" data-grupo="${esc(g)}" data-id="${esc(c.id)}" ${actual === c.id ? 'checked' : ''}>
            <span>${esc(c.nombre)}</span>
          </label>`);
      } else if (alternativas.length > 1) {
        const opts = alternativas.map(a => `<option value="${esc(a.id)}" ${actual === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`);
        if (puedeNinguna) opts.push(`<option value="" ${actual === null ? 'selected' : ''}>Ninguna</option>`);
        añadir(c.categoria, `
          <div class="field">
            <label>${esc(etiquetaGrupo(alternativas))}</label>
            <select data-grupo="${esc(g)}">${opts.join('')}</select>
          </div>`);
      }
    } else if (!g && c.tipo === 'opcional') {
      añadir(c.categoria, `
        <label class="opt">
          <input type="checkbox" data-opcional="${esc(c.id)}" ${state.opcionales.has(c.id) ? 'checked' : ''}>
          <span>${esc(c.nombre)}</span>
        </label>`);
    }
  }

  document.getElementById('opciones').innerHTML = porCategoria.size
    ? [...porCategoria].map(([cat, items]) => `<div class="cat"><h4>${esc(cat)}</h4>${items.join('')}</div>`).join('')
    : '<p class="hint">El catálogo no tiene opciones para este modelo.</p>';
}

// Aviso si el invernadero no cabe en la parcela introducida
function avisoParcela(r) {
  if (state.terreno) {
    const g = r.geometria, imp = implantacionActual(g), h = holguraProyecto();
    if (!imp) return `<div class="aviso rojo">El invernadero (${fmtNum(g.largo, 2)} × ${fmtNum(g.ancho_total, 2)} m) no cabe en la parcela del Catastro dejando ${fmtNum(h, 2)} m a los linderos. Prueba con «Buscar las 3 mejores implantaciones».</div>`;
    const d = PARCELA.holguraRect(state.terreno.anillos, imp).distancia;
    return d < h - 1e-6 ? `<div class="aviso rojo">El invernadero queda a ${d < 0 ? 'fuera de la parcela' : fmtNum(d, 2) + ' m del lindero'}; se exigen ${fmtNum(h, 2)} m.</div>` : '';
  }
  const parcela = parcelaDelProyecto();
  if (!parcela) return '';
  const e = PLANOS_A3.encaje(r.geometria, parcela);
  if (e.cabe) return '';
  const falta = [e.faltaLargo > 0 ? `${fmtNum(e.faltaLargo, 2)} m a lo largo` : '', e.faltaAncho > 0 ? `${fmtNum(e.faltaAncho, 2)} m a lo ancho` : ''].filter(Boolean).join(' y ');
  return `<div class="aviso rojo">El invernadero no cabe en la parcela${parcela.holgura ? ` dejando ${fmtNum(parcela.holgura, 2)} m a los linderos` : ''}: faltan ${falta}${parcela.girado ? '' : ' (prueba a girarlo 90°)'}.</div>`;
}

function renderSummary({ modelo, r }) {
  const g = r.geometria, p = r.precio, v = r.ventilacion, e = r.emplazamiento;
  const cell = (label, value) => `<div class="cell"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  const textoApto = { apto: 'Apto', al_limite: 'Al límite', no_apto: 'No apto — requiere cálculo' };
  const estimados = r.lineas.filter(l => l.origen === 'estimado').length;
  const emp = CATALOGO.empresa || {};

  document.getElementById('summary').innerHTML = `
    <h3>Resumen del proyecto</h3>
    <div class="summary-grid">
      ${cell('Superficie', `${fmtNum(g.area, 0)} m²`)}
      ${cell('Largo × Ancho', `${fmtNum(g.largo)} × ${fmtNum(g.ancho_total)} m`)}
      ${cell('Volumen', `${fmtNum(g.volumen, 0)} m³`)}
      ${cell('Pilares / cerchas', `${g.pilares + g.pilares_hastial} / ${g.porticos * g.naves}`)}
      ${cell('Acero', `${fmtNum(p.kg_acero, 0)} kg <small>${fmtNum(p.kg_acero_m2, 2)} kg/m²</small>`)}
      ${cell('Ventilación efectiva', `${fmtNum(v.pct_total * 100)} % <small>cenital ${fmtNum(v.pct_cenital * 100)} %</small>`)}
      ${cell('Precio sin IVA', `${fmtNum(p.eur_m2, 2)} €/m²`)}
      ${cell('Total IVA incl.', fmtEuro(p.total))}
    </div>

    <div class="avisos">
      ${avisoParcela(r)}${r.avisos.map(a => `<div class="aviso ${a.nivel}">${esc(a.texto)}</div>`).join('')}
    </div>

    <table>
      <tr><td>Modelo</td><td>${esc(modelo.nombre)}</td></tr>
      <tr><td>Naves</td><td>${g.naves} × ${fmtNum(g.ancho_nave, 2)} m</td></tr>
      <tr><td>Tramos entre pórticos</td><td>${g.tramos} × ${fmtNum(g.sep_porticos, 2)} m</td></tr>
      <tr><td>Altura canal / cumbrera</td><td>${fmtNum(g.altura_canal, 2)} m / ${fmtNum(g.altura_cumbrera, 2)} m</td></tr>
      <tr><td>Viento declarado (cerrado)</td><td>${modelo.viento_cerrado ?? '—'} km/h</td></tr>
      ${e ? `<tr><td>Emplazamiento (${[state.viento_kmh !== '' ? `viento ${fmtNum(state.viento_kmh, 1)} km/h` : '', state.nieve_kgm2 !== '' ? `nieve ${fmtNum(state.nieve_kgm2, 0)} kg/m²` : ''].filter(Boolean).join(', ')})</td><td class="apto-${e.resultado}">${textoApto[e.resultado]}</td></tr>` : ''}
    </table>

    <h4 class="sub">Desglose por categoría</h4>
    <table>
      ${Object.entries(p.categorias).map(([cat, imp]) =>
        `<tr><td>${esc(cat)}</td><td>${fmtEuro(imp)}</td></tr>`
      ).join('')}
      ${p.obra ? `<tr><td>Obra local · ${esc(p.obra.zona)}</td><td>${fmtEuro(p.obra.total)}</td></tr>` : ''}
      <tr class="total"><td>Base imponible</td><td>${fmtEuro(p.base_imponible)}</td></tr>
      <tr><td>IVA ${fmtNum(p.iva_pct * 100, 0)} %</td><td>${fmtEuro(p.iva)}</td></tr>
      <tr class="total"><td>Total (IVA incluido)</td><td>${fmtEuro(p.total)}</td></tr>
    </table>

    <div class="disclaimer">
      Catálogo: <strong>${esc(emp.nombre || '—')}</strong>${emp.version_catalogo ? ` · versión ${esc(emp.version_catalogo)}` : ''}${emp.fecha ? ` (${esc(emp.fecha)})` : ''}.
      ${estimados ? `${estimados} de ${r.lineas.length} partidas usan valores <strong>estimados</strong>, no datos del fabricante.` : ''}
    </div>
  `;
}

function renderMateriales({ r }) {
  const p = r.precio, g = r.geometria;
  const ver = state.verCalculo;
  const col = ver ? 6 : 5;
  let filas = '';
  for (const cat of Object.keys(p.categorias)) {
    filas += `<tr class="cat"><td colspan="${col - 1}">${esc(cat)}</td><td class="n">${fmtEuro(p.categorias[cat])}</td></tr>`;
    for (const l of r.lineas.filter(x => x.categoria === cat)) {
      const pct = l.traza.regla === 'porcentaje';
      const cant = pct ? `${fmtNum(l.cantidad * 100, 0)} %`
        : l.metros !== undefined ? `${fmtNum(l.metros)} m` // perfiles: metros; los kg van en su columna
        : `${fmtNum(l.cantidad)} ${esc(l.unidad)}`;
      filas += `<tr>
        <td>${esc(l.nombre)}${l.origen === 'estimado' ? ' <span class="est">estimado</span>' : ''}</td>
        ${ver ? `<td class="traza">${esc(l.traza.calculo || '')}</td>` : ''}
        <td class="n">${cant}</td>
        <td class="n">${l.kg ? fmtNum(l.kg, 0) : ''}</td>
        <td class="n">${pct || l.precio_unitario == null ? '' : fmtNum(l.precio_unitario, 2)}</td>
        <td class="n">${l.importe == null ? '—' : fmtEuro(l.importe)}</td>
      </tr>`;
    }
  }
  if (p.obra) {
    const o = p.obra;
    filas += `<tr class="cat"><td colspan="${col - 1}">Obra local · ${esc(o.zona)}</td><td class="n">${fmtEuro(o.total)}</td></tr>`;
    for (const [nombre, calculo, importe] of [
      ['Movilización', 'por obra', o.movilizacion],
      ['Montaje', `${fmtNum(g.area, 0)} m²`, o.montaje],
      ['Hoyos y dados', `${g.pilares + g.pilares_hastial} pilares`, o.hoyos]
    ]) {
      filas += `<tr><td>${nombre}${o.origen === 'estimado' ? ' <span class="est">estimado</span>' : ''}</td>
        ${ver ? `<td class="traza">${calculo}</td>` : ''}<td></td><td></td><td></td><td class="n">${fmtEuro(importe)}</td></tr>`;
    }
  }
  filas += `<tr class="total"><td colspan="${col - 1}">Base imponible</td><td class="n">${fmtEuro(p.base_imponible)}</td></tr>`;

  document.getElementById('materiales').innerHTML = `
    <h3>Lista de materiales
      <span class="acciones-materiales">
        <button id="btn-ver-calculo" class="btn-secundario">${ver ? 'Ocultar cálculo' : 'Ver cálculo'}</button>
      </span>
    </h3>
    <table class="tabla-materiales">
      <tr><th>Partida</th>${ver ? '<th>Cálculo</th>' : ''}<th class="n">Cantidad</th><th class="n">kg</th><th class="n">Precio u.</th><th class="n">Importe</th></tr>
      ${filas}
    </table>
    ${ver ? '<p class="hint">El cálculo es solo para el distribuidor: no aparece en la propuesta.</p>' : ''}
  `;
}

// Planos: hojas A3 a escala (js/planos/). La ventana que dibujan sale del
// resultado del motor, así coincide con la lista de materiales. Qué hojas hay y
// su número los decide PLANOS_A3.juego (alzado frontal y sección juntos si caben).
const PLANOS_VISTAS = { planta: 'planta', 'alzado-frontal': 'alzadoFrontal', 'alzado-lateral': 'alzadoLateral', seccion: 'seccion', emplazamiento: 'emplazamiento' };

// Parcela introducida a mano: solo cuenta con largo y ancho positivos
function parcelaDelProyecto() {
  const p = state.parcela;
  const largo = parseFloat(p.largo), ancho = parseFloat(p.ancho);
  if (!(largo > 0) || !(ancho > 0)) return null;
  return { largo, ancho, orientacion: parseFloat(p.orientacion) || 0, girado: !!p.girado, holgura: holguraProyecto() };
}

// Distancia mínima a los linderos: la mayor del retranqueo y el camino perimetral
// (el camino puede ir dentro del retranqueo)
function holguraProyecto() {
  return Math.max(parseFloat(state.retranqueo) || 0, parseFloat(state.camino) || 0);
}

// Dónde va el invernadero en la parcela del Catastro: la implantación guardada si
// es de estas medidas y cumple la distancia; si no, se vuelve a encajar (la mejor
// orientación en la que cabe). null si no cabe.
let cacheEncaje = { clave: '', imp: null };
function implantacionActual(g) {
  const t = state.terreno;
  if (!t) return null;
  const h = holguraProyecto();
  const imp = t.implantacion;
  const mismas = imp && Math.abs(imp.largo - g.largo) < 1e-6 && Math.abs(imp.ancho - g.ancho_total) < 1e-6;
  if (mismas && PARCELA.holguraRect(t.anillos, imp).distancia >= h - 1e-6) return imp;
  const clave = `${g.largo}|${g.ancho_total}|${h}|${state.orientacion_preferida}|${JSON.stringify(t.anillos[0][0])}`;
  if (cacheEncaje.clave !== clave) {
    const nueva = OPTIMIZADOR.encajar(t.anillos, g.largo, g.ancho_total, h, state.orientacion_preferida);
    cacheEncaje = { clave, imp: nueva && { cx: nueva.cx, cy: nueva.cy, azimut: nueva.azimut, largo: g.largo, ancho: g.ancho_total } };
  }
  if (cacheEncaje.imp) t.implantacion = cacheEncaje.imp;
  return cacheEncaje.imp || (mismas ? imp : null);
}

function ventanasDelProyecto(r) {
  const g = r.geometria, v = r.ventilacion;
  const lineas = v.lineas_cenital || 0;
  const longitud = g.naves * lineas * g.long_ventana_cenital;
  // Puertas: la partida cuya referencia es un equipo de tipo puerta (cantidad y medidas del catálogo)
  const lineaPuerta = r.lineas.find(l => (CATALOGO.equipos || []).some(e => e.id === l.ref && e.tipo === 'puerta'));
  const equipo = lineaPuerta && CATALOGO.equipos.find(e => e.id === lineaPuerta.ref);
  return {
    ventana: lineas ? { lineas, hoja: g.ancho_hoja, rendija: longitud > 0 ? v.cenital_geometrica / longitud : g.ancho_hoja } : null,
    lateral: v.lateral_geometrica > 0 ? { alto: v.lateral_geometrica / (2 * g.largo) } : null,
    puertas: equipo ? { cantidad: lineaPuerta.cantidad, ancho: equipo.ancho_puerta, alto: equipo.alto_puerta } : null
  };
}

// Datos comunes a todas las hojas
function datosPlanos(r) {
  const t = state.terreno;
  const parcela = t ? null : parcelaDelProyecto();
  const imp = t ? implantacionActual(r.geometria) : null;
  return Object.assign({
    g: r.geometria, modelo: getModelo(), empresa: CATALOGO.empresa || {},
    proyecto: { cliente: state.cliente, ubicacion: state.ubicacion, codigo: state.codigoProyecto },
    fecha: new Date().toLocaleDateString('es-ES'),
    parcela,
    terreno: t ? { anillos: t.anillos, meta: t.meta, implantacion: imp, retranqueo: parseFloat(state.retranqueo) || 0, camino: parseFloat(state.camino) || 0 } : undefined,
    // Con parcela se conoce el norte: la planta lo dibuja
    orientacion: imp ? imp.azimut : parcela ? PLANOS_A3.encaje(r.geometria, parcela).azimutInvernadero : undefined
  }, ventanasDelProyecto(r));
}

// Juego de planos del proyecto: [{ clave, vistas, titulo, archivo, numero, hoja }]
// (cada hoja se dibuja al pedirla); el emplazamiento solo si hay parcela
const juegoPlanos = (r) => PLANOS_A3.juego(datosPlanos(r));

// La hoja que muestra una pestaña, o null si es el emplazamiento y no hay parcela
function plano(r, clave) {
  const h = PLANOS_A3.deVista(juegoPlanos(r), clave);
  return h ? h.hoja : null;
}

// Todas las hojas, dibujadas, en orden
function generarPlanos(r) {
  return juegoPlanos(r).map(h => ({ clave: h.clave, titulo: h.titulo, numero: h.numero, archivo: h.archivo, hoja: h.hoja }));
}

const HOJA_SIN_PARCELA = {
  viewBox: '0 0 420 297',
  svg: '<rect width="420" height="297" fill="#fafafa"/><text x="210" y="148" text-anchor="middle" font-size="7" fill="#666" font-family="sans-serif">Carga la parcela del Catastro o introduce su largo y ancho en «Emplazamiento»</text>'
};

function renderPlano({ r }) {
  const p = plano(r, PLANOS_VISTAS[state.vistaActual]) || HOJA_SIN_PARCELA;
  const svg = document.getElementById('plan');
  svg.setAttribute('viewBox', p.viewBox);
  svg.innerHTML = p.svg;

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.vista === state.vistaActual);
  });
}

// ------- Lista de materiales en Excel -------
function descargarExcel() {
  const { r, modelo, error } = calcularTodo();
  if (error) return;
  EXCEL.descargar(XLSX, {
    r, catalogo: CATALOGO, modelo,
    proyecto: { codigo: state.codigoProyecto, cliente: state.cliente, ubicacion: state.ubicacion },
    fecha: new Date().toLocaleDateString('es-ES')
  }, EXPORTAR.nombreArchivo(state.codigoProyecto, 'materiales', new Date(), 'xlsx'));
}

// ------- Planos en PDF -------
async function descargarPlanos(soloEsta) {
  const estado = document.getElementById('pdf-estado');
  const { r, error } = calcularTodo();
  if (error) return;
  const j = juegoPlanos(r);
  const actual = PLANOS_A3.deVista(j, PLANOS_VISTAS[state.vistaActual]);
  if (soloEsta && !actual) { estado.textContent = 'Esta hoja necesita la parcela (del Catastro o sus medidas).'; return; }
  const hojas = soloEsta ? [actual] : j;
  const nombre = EXPORTAR.nombreArchivo(state.codigoProyecto, soloEsta ? actual.archivo : 'planos');
  estado.textContent = 'Generando PDF…';
  try {
    await EXPORTAR.descargar(hojas.map(h => h.hoja), nombre, {
      titulo: `Planos ${state.codigoProyecto || ''} ${state.cliente || ''}`.trim(),
      autor: (CATALOGO.empresa || {}).nombre || ''
    });
    estado.textContent = `${nombre}: ${hojas.length} hoja${hojas.length > 1 ? 's' : ''} A3. Imprimir al 100 % (tamaño real).`;
  } catch (e) {
    estado.textContent = `No se pudo generar el PDF: ${e.message}`;
  }
}

// ------- Propuesta PDF -------
function abrirPropuesta() {
  const { r, error } = calcularTodo();
  if (error) return;
  const html = PROPUESTA.generar({ state, catalogo: CATALOGO, r, perfiles: perfilesUsados(r), planos: generarPlanos(r), sitio: infoSitio(r) });
  document.getElementById('propuesta-container').innerHTML = html;
  document.body.classList.add('modo-propuesta');
}
function cerrarPropuesta() {
  document.body.classList.remove('modo-propuesta');
}

// ------- Terreno: parcela del Catastro y optimizador (fase 6) -------
function cargarArchivoParcela(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    const r = PARCELA.leer(String(lector.result), archivo.name);
    if (r.errores.length) {
      errorParcela = { errores: r.errores, archivo: archivo.name };
      mostrarParcela();
      return;
    }
    errorParcela = null;
    state.terreno = { anillos: r.anillos, meta: r.meta, implantacion: null, avisos: r.avisos };
    // Rústica: la referencia catastral lleva provincia y municipio del Catastro
    const codigo = SITIO.municipioDeRefcat(r.meta.refcat);
    const m = codigo && MUNICIPIOS.porCatastro.get(codigo);
    state.terreno.municipio_catastro = codigo;
    if (m) {
      elegirMunicipio(m);
      delete document.getElementById('municipio').dataset.noEncontrado;
    }
    state.optimizacion = null;
    state.vistaActual = 'emplazamiento';
    render();
  };
  lector.onerror = () => { errorParcela = { errores: ['No se pudo leer el archivo.'], archivo: archivo.name }; mostrarParcela(); };
  lector.readAsText(archivo);
}

// Datos de la parcela cargada (o los errores del último archivo, si no valía)
let errorParcela = null;
function mostrarParcela() {
  const fallo = errorParcela;
  const caja = document.getElementById('parcela-info');
  const t = state.terreno;
  document.querySelectorAll('.parcela-manual').forEach(el => { el.hidden = !!t; });
  if (fallo && !t) {
    caja.innerHTML = `<div class="aviso rojo"><strong>${esc(fallo.archivo)}</strong>: ${fallo.errores.map(esc).join(' ')}</div>`;
    return;
  }
  if (!t) { caja.innerHTML = ''; return; }
  const m = t.meta || {};
  caja.innerHTML = `<div class="parcela-cargada">
      <div><strong>${esc(m.refcat ? 'Ref. catastral ' + m.refcat : m.archivo || 'Parcela')}</strong></div>
      <div>${fmtNum(m.area, 0)} m²${m.area_declarada ? ` (declarada ${fmtNum(m.area_declarada, 0)} m²)` : ''} · ${m.vertices} vértices${m.huecos ? ` · ${m.huecos} hueco${m.huecos > 1 ? 's' : ''}` : ''} · ${esc(m.formato || '')} ${esc(m.srs || '')}</div>
      <div class="hint">${esc(m.archivo || '')}</div>
      ${(t.avisos || []).map(a => `<div class="aviso ambar">${esc(a)}</div>`).join('')}
      <button id="btn-quitar-parcela" class="btn-secundario">Quitar parcela del Catastro</button>
    </div>`;
}

// Anillos de la parcela para el optimizador: la del Catastro o el rectángulo a mano
function anillosParcela() {
  if (state.terreno) return state.terreno.anillos;
  const p = parcelaDelProyecto();
  return p ? PARCELA.rectangulo(p.largo, p.ancho, p.orientacion) : null;
}

function optimizar() {
  const caja = document.getElementById('optimizador');
  const anillos = anillosParcela();
  caja.hidden = false;
  if (!anillos) {
    state.optimizacion = null;
    caja.innerHTML = '<div class="aviso ambar">Carga la parcela del Catastro o introduce su largo y ancho para buscar implantaciones.</div>';
    return;
  }
  caja.innerHTML = '<p class="hint">Buscando la mejor implantación (orientaciones cada 5°, todos los modelos, anchos y separaciones)…</p>';
  // Deja pintar el mensaje antes del cálculo (≈ 1 s)
  setTimeout(() => {
    // Con el rectángulo a mano, el invernadero va paralelo a la parcela o girado 90°
    const p = state.terreno ? null : parcelaDelProyecto();
    const res = OPTIMIZADOR.buscar({
      anillos, catalogo: CATALOGO, holgura: holguraProyecto(), perfil: state.perfil, orientacion: state.orientacion_preferida,
      azimuts: p ? [p.orientacion, p.orientacion + 90] : undefined,
      base: { seleccion: state.seleccion, opcionales: [...state.opcionales], puertas: state.puertas, zona: state.zona || undefined,
        sitio: sitioProyecto() }
    });
    state.optimizacion = { res, anillos, elegida: null };
    renderOptimizador();
  }, 30);
}

function renderOptimizador() {
  const caja = document.getElementById('optimizador');
  const o = state.optimizacion;
  if (!o) { caja.hidden = true; caja.innerHTML = ''; return; }
  caja.hidden = false;
  const { res } = o;
  const avisos = res.avisos.map(a => `<div class="aviso ambar">${esc(a)}</div>`).join('');
  if (!res.mejores.length) {
    caja.innerHTML = `<h3>Implantaciones</h3>${avisos || '<div class="aviso rojo">No cabe ningún invernadero.</div>'}`;
    return;
  }
  const orient = (az) => `${az}° ${az === 0 ? '(cumbrera norte-sur)' : az === 90 ? '(cumbrera este-oeste)' : ''}`;
  const G = OPTIMIZADOR.GRUPO_VENTANA;
  // Marcada mientras la pantalla siga con sus medidas y su ventana
  const esLaActual = (c) => c.modelo.id === state.modelo && c.naves === state.naves && c.tramos === state.tramos
    && (!c.ventana || state.seleccion[G] === c.ventana.id);
  const tarjetas = res.mejores.map((c, i) => `
    <div class="candidata${o.elegida === i && esLaActual(c) ? ' elegida' : ''}${c.enRojo ? ' en-rojo' : ''}" data-candidata="${i}">
      <div class="candidata-cabecera"><span class="puesto">${i + 1}</span> ${esc(c.modelo.nombre)}</div>
      ${c.enRojo ? `<div class="aviso rojo">${esc(c.aviso)}</div>` : ''}
      ${CROQUIS.svg(o.anillos, c)}
      <table>
        <tr><td>Ventana cenital</td><td>${esc(c.ventana ? c.ventana.nombre : 'Sin ventana')}</td></tr>
        <tr><td>Naves × tramos</td><td>${c.naves} × ${c.tramos}</td></tr>
        <tr><td>Medidas</td><td>${fmtNum(c.ancho, 2)} × ${fmtNum(c.largo, 2)} m</td></tr>
        <tr><td>Superficie</td><td><strong>${fmtNum(c.area, 0)} m²</strong></td></tr>
        <tr><td>Precio</td><td><strong>${fmtNum(c.eur_m2, 2)} €/m²</strong></td></tr>
        <tr><td>Ventilación</td><td>${fmtNum(c.ventilacion * 100)} % <small>cenital ${fmtNum(c.ventilacion_cenital * 100)} %</small></td></tr>
        <tr><td>Orientación</td><td>${orient(c.azimut)}</td></tr>
        <tr><td>Puntuación</td><td>${fmtNum(c.puntuacion * 100, 0)} / 100</td></tr>
      </table>
      <button class="btn-primary btn-elegir" data-elegir="${i}">${o.elegida === i && esLaActual(c) ? '✓ Elegida' : 'Elegir'}</button>
    </div>`).join('');
  const p = res.pesos;
  const pref = OPTIMIZADOR.ORIENTACIONES[res.orientacion];
  caja.innerHTML = `<h3>Las 3 mejores implantaciones <small>· ${esc(res.perfil)}: coste ${p.coste * 100} %, superficie ${p.superficie * 100} %, ventilación ${p.ventilacion * 100} %, orientación ${p.orientacion * 100} % (${esc(pref ? pref.nombre.toLowerCase() : '')}) · ${res.candidatas} combinaciones</small></h3>
    ${avisos}
    <div class="candidatas">${tarjetas}</div>
    <p class="hint">A ${fmtNum(holguraProyecto(), 2)} m de los linderos como mínimo. Cada opción se calcula con cada ventana cenital del catálogo y se muestra la mejor de cada modelo + ventana. Precios del catálogo cargado; al elegir una, se rellenan modelo, ventana, naves, tramos, ancho y separación y se generan los planos.</p>`;
}

function elegirCandidata(i) {
  const o = state.optimizacion;
  const c = o && o.res.mejores[i];
  if (!c) return;
  state.modelo = c.modelo.id;
  state.naves = c.naves;
  state.tramos = c.tramos;
  state.ancho_nave = c.ancho_nave;
  state.separacion = c.separacion;
  if (c.ventana) state.seleccion[OPTIMIZADOR.GRUPO_VENTANA] = c.ventana.id;
  depurarSeleccion();
  const imp = c.implantacion;
  if (state.terreno) {
    state.terreno.implantacion = { cx: imp.cx, cy: imp.cy, azimut: imp.azimut, largo: c.largo, ancho: c.ancho };
  } else {
    // Parcela rectangular a mano: el invernadero va centrado; girado si su largo va a lo ancho de la parcela
    const dif = ((imp.azimut - (parseFloat(state.parcela.orientacion) || 0)) % 180 + 180) % 180;
    state.parcela.girado = dif > 45 && dif < 135;
    document.getElementById('parcela-girado').checked = state.parcela.girado;
  }
  o.elegida = i;
  state.vistaActual = 'emplazamiento';
  render();
}

// ------- Eventos -------
function bindEvents() {
  const entero = (v, min) => Math.max(min, parseInt(v, 10) || min);
  const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, e => { fn(e.target); render(); });

  on('model-select', 'change', el => {
    state.modelo = el.value;
    state.altura_canal = state.ancho_nave = state.separacion = null; // valores por defecto del nuevo modelo
    depurarSeleccion();
  });
  on('num-naves', 'input', el => { state.naves = entero(el.value, 1); });
  on('num-tramos', 'input', el => { state.tramos = entero(el.value, 1); });
  on('puertas', 'input', el => { state.puertas = entero(el.value, 0); });
  on('ancho-nave', 'change', el => { state.ancho_nave = +el.value; });
  on('separacion', 'change', el => { state.separacion = +el.value; });
  on('altura-canal', 'change', el => { state.altura_canal = +el.value; });
  on('zona', 'change', el => { state.zona = el.value; });
  on('viento', 'input', el => { state.viento_kmh = el.value === '' ? '' : Math.max(0, +el.value || 0); state.sitio.viento_manual = true; });
  on('nieve', 'input', el => { state.nieve_kgm2 = el.value === '' ? '' : Math.max(0, +el.value || 0); state.sitio.nieve_manual = true; });
  // Elegir zona, capital o altitud = usar los valores del CTE para esa carga
  on('zona-eolica', 'change', el => { state.sitio.zona_eolica = el.value; state.sitio.viento_manual = false; state.sitio.municipio = null; });
  on('zona-invierno', 'change', el => { state.sitio.zona_invierno = el.value === '' ? '' : +el.value; state.sitio.capital = ''; state.sitio.nieve_manual = false; state.sitio.municipio = null; });
  on('altitud', 'input', el => { state.sitio.altitud = el.value === '' ? '' : +el.value; state.sitio.capital = ''; state.sitio.nieve_manual = false; state.sitio.municipio = null; });
  on('capital-cte', 'change', el => {
    const c = el.value && SITIO.capital(NORMATIVA, el.value);
    state.sitio.capital = c ? c.nombre : '';
    if (c) { state.sitio.altitud = c.altitud; document.getElementById('altitud').value = c.altitud; }
    state.sitio.nieve_manual = false;
    state.sitio.municipio = null;
  });
  on('municipio', 'change', el => {
    const m = MUNICIPIOS.buscar(el.value);
    delete el.dataset.noEncontrado;
    if (m) elegirMunicipio(m);
    else if (el.value.trim() === '') state.sitio.municipio = null;
    else el.dataset.noEncontrado = el.value.trim();
  });
  on('btn-cargas-municipio', 'click', () => { state.sitio.viento_manual = state.sitio.nieve_manual = false; });
  on('categoria-terreno', 'change', el => { state.sitio.categoria = el.value; });
  on('pendiente', 'input', el => { state.sitio.pendiente = el.value === '' ? '' : Math.max(0, +el.value || 0); });
  on('parcela-largo', 'input', el => { state.parcela.largo = el.value; });
  on('parcela-ancho', 'input', el => { state.parcela.ancho = el.value; });
  on('parcela-orientacion', 'input', el => { state.parcela.orientacion = el.value; });
  on('parcela-girado', 'change', el => { state.parcela.girado = el.checked; });
  on('retranqueo', 'input', el => { state.retranqueo = Math.max(0, parseFloat(el.value) || 0); state.optimizacion = null; });
  on('camino', 'input', el => { state.camino = Math.max(0, parseFloat(el.value) || 0); state.optimizacion = null; });
  document.getElementById('perfil').addEventListener('change', e => {
    state.perfil = e.target.value;
    if (state.optimizacion) optimizar(); // mismas candidatas, otra puntuación
  });
  document.getElementById('orientacion-preferida').addEventListener('change', e => {
    state.orientacion_preferida = e.target.value;
    if (state.optimizacion) optimizar(); else render();
  });
  document.getElementById('btn-optimizar').addEventListener('click', optimizar);
  document.getElementById('btn-cargar-parcela').addEventListener('click', () => document.getElementById('archivo-parcela').click());
  document.getElementById('archivo-parcela').addEventListener('change', e => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) cargarArchivoParcela(archivo);
  });
  document.getElementById('parcela-info').addEventListener('click', e => {
    if (e.target.id !== 'btn-quitar-parcela') return;
    state.terreno = null;
    state.optimizacion = null;
    errorParcela = null;
    render();
  });
  document.getElementById('optimizador').addEventListener('click', e => {
    const b = e.target.closest('[data-elegir]');
    if (b) elegirCandidata(+b.dataset.elegir);
  });
  document.getElementById('btn-guardar-proyecto').addEventListener('click', guardarProyecto);
  document.getElementById('btn-abrir-proyecto').addEventListener('click', () => document.getElementById('archivo-proyecto').click());
  document.getElementById('archivo-proyecto').addEventListener('change', e => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) abrirProyecto(archivo);
  });
  document.getElementById('btn-pdf-todos').addEventListener('click', () => descargarPlanos(false));
  document.getElementById('btn-pdf-hoja').addEventListener('click', () => descargarPlanos(true));
  on('opciones', 'change', el => {
    if (el.dataset.opcional) {
      if (el.checked) state.opcionales.add(el.dataset.opcional);
      else state.opcionales.delete(el.dataset.opcional);
    } else if (el.dataset.grupo) {
      state.seleccion[el.dataset.grupo] = el.type === 'checkbox'
        ? (el.checked ? el.dataset.id : null)
        : (el.value || null);
    }
  });

  for (const id of ['cliente', 'ubicacion', 'codigo-proyecto']) {
    document.getElementById(id).addEventListener('input', e => {
      const key = id === 'codigo-proyecto' ? 'codigoProyecto' : id;
      state[key] = e.target.value;
      const datos = calcularTodo();
      if (!datos.error) renderPlano(datos);
    });
  }
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      state.vistaActual = t.dataset.vista;
      const datos = calcularTodo();
      if (!datos.error) renderPlano(datos);
    });
  });
  document.getElementById('btn-excel').addEventListener('click', descargarExcel);
  document.getElementById('materiales').addEventListener('click', e => {
    if (e.target.id === 'btn-ver-calculo') {
      state.verCalculo = !state.verCalculo;
      render();
    }
  });
  document.getElementById('btn-cargar-catalogo').addEventListener('click', () => {
    document.getElementById('archivo-catalogo').click();
  });
  document.getElementById('archivo-catalogo').addEventListener('change', e => {
    const archivo = e.target.files[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo tras corregirlo
    if (archivo) cargarArchivoCatalogo(archivo);
  });
  document.getElementById('btn-catalogo-ejemplo').addEventListener('click', () => {
    aplicarCatalogo(window.CATALOGO_EJEMPLO, null);
    guardarEnSesion(null);
    render();
  });
  document.getElementById('btn-cerrar-dialogo').addEventListener('click', () => {
    document.body.classList.remove('dialogo-abierto');
  });
  document.getElementById('btn-propuesta').addEventListener('click', abrirPropuesta);
  // Pasos: barra de arriba (solo los visitados) y Anterior / Siguiente
  const irA = (nuevo) => { state.pasos = nuevo; render(); window.scrollTo({ top: 0 }); };
  document.getElementById('barra-pasos').addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b && !b.disabled) irA(PASOS.ir(state.pasos, b.dataset.ir));
  });
  document.getElementById('btn-siguiente').addEventListener('click', () => irA(PASOS.siguiente(state.pasos)));
  document.getElementById('btn-anterior').addEventListener('click', () => irA(PASOS.anterior(state.pasos)));
  document.getElementById('btn-cerrar-propuesta').addEventListener('click', cerrarPropuesta);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
}

document.addEventListener('DOMContentLoaded', () => {
  const guardado = catalogoDeSesion();
  aplicarCatalogo(guardado ? guardado.catalogo : window.CATALOGO_EJEMPLO, guardado ? guardado.origen : null);
  bindEvents();
  render();
});
