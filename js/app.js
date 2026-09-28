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
  parcela: { largo: '', ancho: '', orientacion: 0, girado: false },
  cliente: '',
  ubicacion: '',
  codigoProyecto: '',
  vistaActual: 'planta',
  verCalculo: false
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
    sitio: state.viento_kmh !== '' ? { viento_kmh: +state.viento_kmh } : undefined
  };
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

// ------- Render -------
function render() {
  const datos = calcularTodo();
  renderConfigPanel(datos);
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
  const parcela = parcelaDelProyecto();
  if (!parcela) return '';
  const e = PLANOS_A3.encaje(r.geometria, parcela);
  if (e.cabe) return '';
  const falta = [e.faltaLargo > 0 ? `${fmtNum(e.faltaLargo, 2)} m a lo largo` : '', e.faltaAncho > 0 ? `${fmtNum(e.faltaAncho, 2)} m a lo ancho` : ''].filter(Boolean).join(' y ');
  return `<div class="aviso rojo">El invernadero no cabe en la parcela: faltan ${falta}${parcela.girado ? '' : ' (prueba a girarlo 90°)'}.</div>`;
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
      ${e ? `<tr><td>Emplazamiento (viento ${fmtNum(state.viento_kmh, 0)} km/h)</td><td class="apto-${e.resultado}">${textoApto[e.resultado]}</td></tr>` : ''}
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
      <button id="btn-ver-calculo" class="btn-secundario">${ver ? 'Ocultar cálculo' : 'Ver cálculo'}</button>
    </h3>
    <table class="tabla-materiales">
      <tr><th>Partida</th>${ver ? '<th>Cálculo</th>' : ''}<th class="n">Cantidad</th><th class="n">kg</th><th class="n">Precio u.</th><th class="n">Importe</th></tr>
      ${filas}
    </table>
    ${ver ? '<p class="hint">El cálculo es solo para el distribuidor: no aparece en la propuesta.</p>' : ''}
  `;
}

// Planos: cuatro hojas A3 a escala (js/planos/). La ventana que dibujan sale
// del resultado del motor, así coincide con la lista de materiales.
const PLANOS_VISTAS = { planta: 'planta', 'alzado-frontal': 'alzadoFrontal', 'alzado-lateral': 'alzadoLateral', seccion: 'seccion', emplazamiento: 'emplazamiento' };
const PLANOS_ARCHIVO = { planta: '01-planta', alzadoFrontal: '02-alzado-frontal', alzadoLateral: '03-alzado-lateral', seccion: '04-seccion', emplazamiento: '05-emplazamiento' };

// Parcela introducida a mano: solo cuenta con largo y ancho positivos
function parcelaDelProyecto() {
  const p = state.parcela;
  const largo = parseFloat(p.largo), ancho = parseFloat(p.ancho);
  if (!(largo > 0) || !(ancho > 0)) return null;
  return { largo, ancho, orientacion: parseFloat(p.orientacion) || 0, girado: !!p.girado };
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

// Devuelve la hoja, o null si es el emplazamiento y no hay parcela
function plano(r, clave) {
  const parcela = parcelaDelProyecto();
  if (clave === 'emplazamiento' && !parcela) return null;
  return PLANOS_A3[clave](Object.assign({
    g: r.geometria, modelo: getModelo(), empresa: CATALOGO.empresa || {},
    proyecto: { cliente: state.cliente, ubicacion: state.ubicacion, codigo: state.codigoProyecto },
    fecha: new Date().toLocaleDateString('es-ES'),
    parcela,
    // Con parcela se conoce el norte: la planta lo dibuja
    orientacion: parcela ? PLANOS_A3.encaje(r.geometria, parcela).azimutInvernadero : undefined
  }, ventanasDelProyecto(r)));
}

// Hojas en orden (01…05); el emplazamiento solo si hay parcela
function generarPlanos(r) {
  return Object.fromEntries(Object.values(PLANOS_VISTAS).map(k => [k, plano(r, k)]).filter(([, h]) => h));
}

const HOJA_SIN_PARCELA = {
  viewBox: '0 0 420 297',
  svg: '<rect width="420" height="297" fill="#fafafa"/><text x="210" y="148" text-anchor="middle" font-size="7" fill="#666" font-family="sans-serif">Introduce el largo y el ancho de la parcela en «Emplazamiento»</text>'
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

// ------- Planos en PDF -------
async function descargarPlanos(soloEsta) {
  const estado = document.getElementById('pdf-estado');
  const { r, error } = calcularTodo();
  if (error) return;
  const planos = generarPlanos(r);
  const clave = PLANOS_VISTAS[state.vistaActual];
  if (soloEsta && !planos[clave]) { estado.textContent = 'Esta hoja necesita las medidas de la parcela.'; return; }
  const claves = soloEsta ? [clave] : Object.keys(planos);
  const nombre = EXPORTAR.nombreArchivo(state.codigoProyecto, soloEsta ? PLANOS_ARCHIVO[clave] : 'planos');
  estado.textContent = 'Generando PDF…';
  try {
    await EXPORTAR.descargar(claves.map(k => planos[k]), nombre, {
      titulo: `Planos ${state.codigoProyecto || ''} ${state.cliente || ''}`.trim(),
      autor: (CATALOGO.empresa || {}).nombre || ''
    });
    estado.textContent = `${nombre}: ${claves.length} hoja${claves.length > 1 ? 's' : ''} A3. Imprimir al 100 % (tamaño real).`;
  } catch (e) {
    estado.textContent = `No se pudo generar el PDF: ${e.message}`;
  }
}

// ------- Propuesta PDF -------
function abrirPropuesta() {
  const { r, error } = calcularTodo();
  if (error) return;
  const html = PROPUESTA.generar({ state, catalogo: CATALOGO, r, perfiles: perfilesUsados(r), planos: generarPlanos(r) });
  document.getElementById('propuesta-container').innerHTML = html;
  document.body.classList.add('modo-propuesta');
}
function cerrarPropuesta() {
  document.body.classList.remove('modo-propuesta');
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
  on('viento', 'input', el => { state.viento_kmh = el.value === '' ? '' : Math.max(0, +el.value || 0); });
  on('parcela-largo', 'input', el => { state.parcela.largo = el.value; });
  on('parcela-ancho', 'input', el => { state.parcela.ancho = el.value; });
  on('parcela-orientacion', 'input', el => { state.parcela.orientacion = el.value; });
  on('parcela-girado', 'change', el => { state.parcela.girado = el.checked; });
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
  document.getElementById('btn-cerrar-propuesta').addEventListener('click', cerrarPropuesta);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
}

document.addEventListener('DOMContentLoaded', () => {
  const guardado = catalogoDeSesion();
  aplicarCatalogo(guardado ? guardado.catalogo : window.CATALOGO_EJEMPLO, guardado ? guardado.origen : null);
  bindEvents();
  render();
});
