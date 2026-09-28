// ============================================================
// Configurador de Invernaderos — orquestador principal
// ============================================================
// v0.3 estructural: solo geometría, modelos, opciones de cerramiento
// y propuesta. Equipamiento y agronomía se reincorporarán en una fase
// posterior.

const state = {
  modeloId: MODELOS[0].id,
  numNaves: 2,
  numTramos: 20,
  opcionesActivas: new Set([
    'rec-doble-camara',
    'vent-cenital-motor',
    'serv-supervision',
    'serv-transporte'
  ]),
  cliente: '',
  ubicacion: '',
  codigoProyecto: '',
  vistaActual: 'planta'
};

// ------- Helpers -------
function getModelo() { return MODELOS.find(m => m.id === state.modeloId); }

function calcularTodo() {
  const modelo = getModelo();
  const calc = CALCULOS.estructura(state, modelo);
  const precio = CALCULOS.precio(calc.area, modelo, state.opcionesActivas);
  return { modelo, calc, precio };
}

const fmtEuro = n => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

// ------- Render -------
function render() {
  const datos = calcularTodo();
  renderConfigPanel(datos);
  renderSummary(datos);
  renderEspecificaciones(datos);
  renderPlano(datos);
}

function renderConfigPanel({ modelo }) {
  const modelSelect = document.getElementById('model-select');
  if (modelSelect.options.length === 0) {
    modelSelect.innerHTML = MODELOS.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  }
  modelSelect.value = state.modeloId;
  document.getElementById('model-description').textContent = modelo.descripcion;
  document.getElementById('num-naves').value = state.numNaves;
  document.getElementById('num-tramos').value = state.numTramos;

  const optsContainer = document.getElementById('opciones');
  if (optsContainer.children.length === 0) {
    optsContainer.innerHTML = OPCIONES.map(cat => `
      <div class="cat">
        <h4>${cat.categoria}</h4>
        ${cat.items.map(opt => `
          <label class="opt">
            <input type="checkbox" data-id="${opt.id}">
            <span>${opt.nombre}</span>
            <span class="price">+${opt.precio_m2} €/m²</span>
          </label>
        `).join('')}
      </div>
    `).join('');
  }
  optsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = state.opcionesActivas.has(cb.dataset.id);
  });
}

function renderSummary({ modelo, calc, precio }) {
  document.getElementById('summary').innerHTML = `
    <h3>Resumen del proyecto</h3>
    <div class="summary-grid">
      <div class="cell">
        <div class="label">Superficie</div>
        <div class="value">${calc.area.toFixed(0)} m²</div>
      </div>
      <div class="cell">
        <div class="label">Largo × Ancho</div>
        <div class="value">${calc.largo.toFixed(1)} × ${calc.ancho.toFixed(1)}</div>
      </div>
      <div class="cell">
        <div class="label">Volumen</div>
        <div class="value">${calc.volumen.toFixed(0)} m³</div>
      </div>
      <div class="cell">
        <div class="label">Pilares / Cerchas</div>
        <div class="value">${calc.numPilares} / ${calc.numCerchas}</div>
      </div>
    </div>
    <table>
      <tr><td>Modelo</td><td>${modelo.nombre}</td></tr>
      <tr><td>Ancho de capilla</td><td>${modelo.ancho_nave} m × ${state.numNaves} naves</td></tr>
      <tr><td>Tramos entre pilares</td><td>${state.numTramos} × ${modelo.separacion_pilares} m</td></tr>
      <tr><td>Altura canal / cumbrera</td><td>${modelo.alto_canal} m / ${modelo.alto_cumbrera} m</td></tr>
      <tr><td>Estructura base</td><td>${fmtEuro(calc.area * modelo.precio_base_m2)}</td></tr>
    </table>

    <h4 class="sub">Desglose por categoría</h4>
    <table>
      ${Object.entries(precio.subtotalesCategoria).map(([cat, imp]) =>
        `<tr><td>${cat}</td><td>${fmtEuro(imp)}</td></tr>`
      ).join('')}
      <tr class="total"><td>Subtotal</td><td>${fmtEuro(precio.total)}</td></tr>
      <tr><td>IVA 21 %</td><td>${fmtEuro(precio.total * 0.21)}</td></tr>
      <tr class="total"><td>Total (IVA incluido)</td><td>${fmtEuro(precio.total * 1.21)}</td></tr>
    </table>

    <div class="disclaimer">
      ⚠️ <strong>Valores de ejemplo.</strong> Precios y dimensiones placeholder.
      Ajustar con datos reales de fábrica antes de uso comercial.
    </div>
  `;
}

function renderEspecificaciones({ modelo }) {
  const s = modelo.specs;
  const container = document.getElementById('especificaciones');
  container.innerHTML = `
    <h3>Especificaciones técnicas</h3>
    <div class="specs-grid">
      <div>
        <h5>Estructura</h5>
        <ul>
          <li>Pilares: ${s.pilares.seccion} / ${s.pilares.espesor}</li>
          <li>Canal: ${s.canal.tipo}</li>
          <li>Cerchas: ${s.cerchas.forma} — ${s.cerchas.arco}</li>
          <li>Cumbrera: ${s.cerchas.cumbrera}</li>
        </ul>
      </div>
      <div>
        <h5>Cargas de diseño</h5>
        <ul>
          <li>Viento cerrado: ${s.cargas.viento_max_cerrado}</li>
          <li>Cultivo: ${s.cargas.cultivo}</li>
          <li>Equipamiento: ${s.cargas.equipamiento}</li>
          <li>Nieve: ${s.cargas.nieve}</li>
        </ul>
      </div>
      <div>
        <h5>Cimentación</h5>
        <ul>
          <li>Resistencia: ${s.cimentacion.resistencia_terreno}</li>
          <li>Ángulo fricción: ${s.cimentacion.angulo_frotamiento}</li>
          <li>Compactación: ${s.cimentacion.compactacion}</li>
        </ul>
      </div>
      <div>
        <h5>Normativa</h5>
        <ul>${s.normativa.slice(0, 3).map(n => `<li>${n}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

function renderPlano({ modelo, calc }) {
  const svg = document.getElementById('plan');
  let contenido = '';
  switch (state.vistaActual) {
    case 'planta':         contenido = PLANOS.planta(state, calc, modelo); break;
    case 'alzado-frontal': contenido = PLANOS.alzadoFrontal(state, calc, modelo); break;
    case 'alzado-lateral': contenido = PLANOS.alzadoLateral(state, calc, modelo); break;
    case 'seccion':        contenido = PLANOS.seccion(state, calc, modelo); break;
  }
  svg.innerHTML = contenido;

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.vista === state.vistaActual);
  });
}

// ------- Propuesta PDF -------
function abrirPropuesta() {
  const { modelo, calc, precio } = calcularTodo();
  const planos = {
    planta:        PLANOS.planta(state, calc, modelo),
    alzadoFrontal: PLANOS.alzadoFrontal(state, calc, modelo),
    alzadoLateral: PLANOS.alzadoLateral(state, calc, modelo),
    seccion:       PLANOS.seccion(state, calc, modelo)
  };
  const html = PROPUESTA.generar(state, modelo, calc, precio, planos);
  document.getElementById('propuesta-container').innerHTML = html;
  document.body.classList.add('modo-propuesta');
}
function cerrarPropuesta() {
  document.body.classList.remove('modo-propuesta');
}

// ------- Eventos -------
function bindEvents() {
  document.getElementById('model-select').addEventListener('change', e => {
    state.modeloId = e.target.value;
    render();
  });
  document.getElementById('num-naves').addEventListener('input', e => {
    state.numNaves = Math.max(1, parseInt(e.target.value, 10) || 1);
    render();
  });
  document.getElementById('num-tramos').addEventListener('input', e => {
    state.numTramos = Math.max(1, parseInt(e.target.value, 10) || 1);
    render();
  });
  document.getElementById('opciones').addEventListener('change', e => {
    if (e.target.type === 'checkbox') {
      const id = e.target.dataset.id;
      if (e.target.checked) state.opcionesActivas.add(id);
      else state.opcionesActivas.delete(id);
      render();
    }
  });
  for (const id of ['cliente', 'ubicacion', 'codigo-proyecto']) {
    document.getElementById(id).addEventListener('input', e => {
      const key = id === 'codigo-proyecto' ? 'codigoProyecto' : id;
      state[key] = e.target.value;
      renderPlano(calcularTodo());
    });
  }
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      state.vistaActual = t.dataset.vista;
      renderPlano(calcularTodo());
    });
  });
  document.getElementById('btn-propuesta').addEventListener('click', abrirPropuesta);
  document.getElementById('btn-cerrar-propuesta').addEventListener('click', cerrarPropuesta);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  render();
});
