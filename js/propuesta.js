// ============================================================
// Generación de la propuesta comercial (HTML imprimible a PDF)
// ============================================================
// Todo sale del catálogo (empresa, modelo, categorías y texto de propuesta
// de cada partida) y del resultado del motor. Cualquier valor que sea o que
// dependa de un dato con origen «estimado» lleva asterisco: la propuesta nunca
// lo presenta como dato del fabricante. La traza del cálculo no se incluye.
// Los planos van en páginas A3 apaisadas a escala real (el resto, A4).

const PROPUESTA = {

  generar({ state, catalogo, r, perfiles, planos, sitio }) {
    const emp = catalogo.empresa || {};
    const modelo = catalogo.modelos.find(m => m.id === r.modelo.id);
    const ctx = {
      state, emp, modelo, r, perfiles,
      g: r.geometria,
      fecha: new Date().toLocaleDateString('es-ES'),
      codigo: state.codigoProyecto || 'PROP-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      cliente: state.cliente || 'Cliente no especificado',
      ubicacion: state.ubicacion || '—',
      categorias: Object.keys(r.precio.categorias),
      // Sitio (municipio, cargas del CTE, categoría, pendiente); sin él, lo que haya en la pantalla
      sitio: sitio || {
        viento_kmh: state.viento_kmh ?? '', nieve_kgm2: state.nieve_kgm2 ?? '', pendiente: (state.sitio && state.sitio.pendiente) ?? '',
        origen_viento: state.viento_kmh !== '' && state.viento_kmh !== undefined ? 'manual' : '', origen_nieve: state.nieve_kgm2 ? 'manual' : ''
      }
    };
    // Qué valores dependen de datos estimados
    const est = (l) => l.origen === 'estimado';
    const refDe = (id) => ['equipos', 'cubiertas'].map(h => (catalogo[h] || []).find(x => x.id === id)).find(Boolean);
    ctx.estimado = {
      modelo: modelo.origen === 'estimado',
      categoria: (cat) => r.lineas.some(l => l.categoria === cat && est(l)),
      acero: r.lineas.some(l => l.kg && est(l)),
      ventilacion: r.lineas.some(l => { const f = refDe(l.ref); return f && (f.tipo === 'ventana' || f.tipo === 'malla') && est(l); })
        || (catalogo.cubiertas || []).some(c => c.tipo === 'malla' && c.origen === 'estimado'),
      obra: !!(r.precio.obra && r.precio.obra.origen === 'estimado')
    };
    ctx.estimado.total = Object.keys(r.precio.categorias).some(ctx.estimado.categoria) || ctx.estimado.obra;
    return `
      <div class="propuesta">
        ${this._portada(ctx)}
        ${this._indice(ctx)}
        ${this._antecedentes(ctx)}
        ${this._dimensiones(ctx)}
        ${this._planos(planos)}
        ${this._cargas(ctx)}
        ${this._capitulos(ctx)}
        ${this._precios(ctx)}
        ${this._condiciones(ctx)}
        ${this._garantia(ctx)}
        ${this._datosOferta(ctx)}
      </div>
    `;
  },

  // ---------- Utilidades ----------
  _esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },
  _num(n, d = 2) { return (n ?? 0).toLocaleString('es-ES', { maximumFractionDigits: d }); },
  _eur(n) { return (n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; },
  _est(origen) { return origen === 'estimado' ? '<sup class="est-marca">*</sup>' : ''; },
  _marca(estimado) { return estimado ? '<sup class="est-marca">*</sup>' : ''; },
  _lista(texto) {
    return String(texto || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  },
  _familia(modelo) {
    return { multitunel: 'MULTITÚNEL', venlo: 'VENLO' }[modelo.familia] || '';
  },
  _hayEstimados({ r, modelo, estimado }) {
    return modelo.origen === 'estimado' || r.lineas.some(l => l.origen === 'estimado') || estimado.obra || estimado.ventilacion;
  },
  _notaEstimados(ctx) {
    return this._hayEstimados(ctx)
      ? '<p class="nota">* Valor estimado, pendiente de confirmación por el fabricante.</p>'
      : '';
  },

  // ---------- Secciones ----------
  _portada({ emp, modelo, codigo, cliente, ubicacion, fecha }) {
    const catalogo = [emp.version_catalogo ? `catálogo ${emp.version_catalogo}` : '', emp.fecha || ''].filter(Boolean).join(' · ');
    return `
      <section class="page portada">
        <div class="logo-top">${this._esc(emp.nombre || 'CONFIGURADOR INVERNADEROS')}</div>
        <div class="meta">
          <div><strong>${this._esc(codigo)}</strong></div>
          <div>Ed: 00</div>
          <div>${this._esc(cliente)}</div>
          <div>${this._esc(ubicacion)}</div>
          <div>${fecha}</div>
        </div>
        <div class="titulo">
          <h1>PRESUPUESTO DE INVERNADERO ${this._familia(modelo)}</h1>
          <h2>${this._esc(modelo.nombre)} · Descripción técnica</h2>
        </div>
        <div class="empresa-portada">
          Oferta presentada por <strong>${this._esc(emp.nombre || '—')}</strong>
          ${catalogo ? `<br><small>${this._esc(catalogo)}</small>` : ''}
        </div>
        <div class="disclaimer-portada">
          Las imágenes y planos no son contractuales
        </div>
      </section>
    `;
  },

  _indice({ categorias }) {
    return `
      <section class="page">
        <h2>ÍNDICE</h2>
        <ol class="indice">
          <li>DESCRIPCIÓN DEL INVERNADERO
            <ol>
              <li>Antecedentes del proyecto</li>
              <li>Dimensiones del invernadero</li>
              <li>Planos del proyecto (planta, alzados y sección)</li>
              <li>Cargas de cálculo y emplazamiento</li>
            </ol>
          </li>
          <li>COMPOSICIÓN
            <ol>${categorias.map(c => `<li>${this._esc(c)}</li>`).join('')}</ol>
          </li>
          <li>PRECIOS</li>
          <li>OTRAS CONDICIONES</li>
          <li>GARANTÍAS</li>
        </ol>
      </section>
    `;
  },

  _antecedentes({ modelo, g, cliente, ubicacion }) {
    return `
      <section class="page">
        <h2>1. DESCRIPCIÓN DEL INVERNADERO</h2>
        <h3>1.1 Antecedentes del proyecto</h3>
        <p>
          A petición de <strong>${this._esc(cliente)}</strong>, ubicado en <strong>${this._esc(ubicacion)}</strong>,
          se presenta la siguiente propuesta técnica y económica para la instalación de un
          invernadero <strong>${this._esc(modelo.nombre.toLowerCase())}</strong> con una superficie total
          de <strong>${this._num(g.area, 0)} m²</strong>.
        </p>
        ${modelo.descripcion ? `<p>${this._esc(modelo.descripcion)}</p>` : ''}
      </section>
    `;
  },

  _dimensiones({ g, r, estimado }) {
    const v = r.ventilacion;
    const m = this._marca(estimado.modelo);  // la flecha del arco es dato del modelo
    return `
      <section>
        <h3>1.2 Dimensiones del invernadero</h3>
        <table class="tabla">
          <tr><th>Parámetro</th><th>Valor</th></tr>
          <tr><td>Ancho total</td><td>${this._num(g.ancho_total)} m</td></tr>
          <tr><td>Largo total</td><td>${this._num(g.largo)} m</td></tr>
          <tr><td>Nº de naves</td><td>${g.naves}</td></tr>
          <tr><td>Ancho de nave</td><td>${this._num(g.ancho_nave)} m</td></tr>
          <tr><td>Altura a canal</td><td>${this._num(g.altura_canal)} m</td></tr>
          <tr><td>Altura a cumbrera</td><td>${this._num(g.altura_cumbrera)} m${m}</td></tr>
          <tr><td>Separación entre pórticos</td><td>${this._num(g.sep_porticos)} m</td></tr>
          <tr><td>Nº de pórticos</td><td>${g.porticos}</td></tr>
          <tr><td>Nº de pilares (incl. hastiales)</td><td>${g.pilares + g.pilares_hastial}</td></tr>
          <tr><td>Volumen interior</td><td>${this._num(g.volumen, 0)} m³${m}</td></tr>
          <tr><td>Ventilación efectiva (con malla)</td><td>${this._num(v.pct_total * 100, 1)} % del suelo · cenital ${this._num(v.pct_cenital * 100, 1)} %${this._marca(estimado.ventilacion)}</td></tr>
          <tr class="total"><td>Superficie total invernadero</td><td>${this._num(g.area)} m²</td></tr>
        </table>
      </section>
    `;
  },

  _planos(planos) {
    if (!planos) return '';
    const orden = [['planta', 'Planta general'], ['alzadoFrontal', 'Alzado frontal'], ['alzadoLateral', 'Alzado lateral'],
      ['seccion', 'Sección transversal'], ['emplazamiento', 'Emplazamiento']].filter(([k]) => planos[k]);
    const hoja = ([k, titulo]) => `
      <section class="hoja-a3" data-plano="${k}" aria-label="${titulo}">
        <svg class="plano-a3" viewBox="${planos[k].viewBox}" xmlns="http://www.w3.org/2000/svg">${planos[k].svg}</svg>
      </section>`;
    return `
      <section class="page">
        <h3>1.3 Planos del proyecto</h3>
        <p>
          Se incluyen a continuación, en hojas A3, los planos del invernadero:
          ${orden.map(([, t]) => t.toLowerCase()).join(', ')}. Todas las cotas están
          expresadas en metros. Impresos en A3 al 100 % (tamaño real), la escala
          indicada en cada cajetín es exacta; a otro tamaño, vale la escala gráfica.
        </p>
        <p class="disclaimer">
          Planos informativos de oferta. No válidos para ejecución ni tramitación.
        </p>
        <ol>${orden.map(([k, t]) => `<li>${t} (1:${planos[k].escala})</li>`).join('')}</ol>
      </section>
      ${orden.map(hoja).join('')}
    `;
  },

  _cargas(ctx) {
    const { modelo, r, sitio } = ctx;
    const e = r.emplazamiento;
    const m = this._est(modelo.origen);
    const fila = (txt, val, ud) => (val === undefined || val === null || val === '')
      ? '' : `<tr><td>${txt}</td><td>${this._num(val, 1)} ${ud}${m}</td></tr>`;
    const textoApto = {
      apto: 'Apto',
      al_limite: 'Al límite (margen 10 %)',
      no_apto: 'No apto: requiere cálculo',
      sin_dato: 'Sin dato del fabricante'
    };
    const s = sitio || {};
    const origen = (o) => o === 'municipio' ? 'CTE DB SE-AE, por municipio' : o === 'manual' ? 'introducido a mano' : '';
    const valor = (v, d, ud) => (v === '' || v === undefined || v === null) ? '—' : `${this._num(v, d)} ${ud}`;
    const declarado = (v, ud) => (v > 0 ? `${this._num(v, 0)} ${ud}${m}` : 'no declarado');
    const filaCarga = (txt, vSitio, d, ud, o, vDecl, res) => `<tr><td>${txt}</td><td>${valor(vSitio, d, ud)}${o ? `<br><small>${origen(o)}</small>` : ''}</td>`
      + `<td>${declarado(vDecl, ud)}</td><td><strong>${vSitio === '' || vSitio === undefined ? '—' : textoApto[res] || '—'}</strong></td></tr>`;
    const mun = s.municipio;
    const c = s.cargas;
    const f2 = (v) => this._num(v, 2);
    return `
      <section class="page">
        <h3>1.4 Cargas de cálculo y emplazamiento</h3>
        <h4>Cargas declaradas del modelo</h4>
        <table class="tabla">
          ${fila('Viento máx. con cerramiento y ventanas cerradas', modelo.viento_cerrado, 'km/h')}
          ${fila('Viento máx. con ventanas abiertas', modelo.viento_abierto, 'km/h')}
          ${fila('Nieve', modelo.nieve, 'kg/m²')}
          ${fila('Cultivo colgado', modelo.cultivo_colgado, 'kg/m²')}
          ${fila('Equipamiento', modelo.equipamiento, 'kg/m²')}
        </table>
        ${e || mun || s.pendiente !== '' ? `
        <h4>Emplazamiento</h4>
        <table class="tabla">
          ${mun ? `<tr><td>Municipio</td><td>${this._esc(mun.nombre)} (${this._esc(mun.provincia)}) · altitud ${this._num(mun.altitud, 0)} m</td></tr>
          <tr><td>Zona eólica / zona climática de invierno</td><td>${this._esc(mun.zona_eolica)} / ${mun.zona_invierno}</td></tr>` : ''}
          <tr><td>Categoría de terreno</td><td>${this._esc(s.categoria || '—')}${c && c.viento.ce !== null ? ` · c<sub>e</sub> ${f2(c.viento.ce)} a ${this._num(c.viento.altura, 1)} m, q<sub>e</sub> ${f2(c.viento.qe)} kN/m² (informativo)` : ''}</td></tr>
          ${s.pendiente !== '' && s.pendiente !== undefined ? `<tr><td>Pendiente del terreno</td><td>${this._num(s.pendiente, 1)} %</td></tr>` : ''}
        </table>` : ''}
        ${e ? `
        <h4>Cargas del sitio frente a las declaradas por el fabricante</h4>
        <table class="tabla tabla-cargas">
          <tr><th>Carga</th><th>Sitio</th><th>Declarada</th><th>Resultado</th></tr>
          ${filaCarga('Viento', s.viento_kmh, 1, 'km/h', s.origen_viento, modelo.viento_cerrado, e.viento)}
          ${filaCarga('Nieve', s.nieve_kgm2, 0, 'kg/m²', s.origen_nieve, modelo.nieve, e.nieve)}
          <tr class="total"><td colspan="3">Resultado</td><td><strong>${textoApto[e.resultado]}</strong></td></tr>
        </table>
        <p class="nota">Comparación orientativa de las cargas del sitio con las declaradas por el fabricante del modelo; <strong>no sustituye al cálculo estructural</strong>.
        Viento del sitio: velocidad básica de la zona eólica (CTE DB SE-AE, anejo D), frente al viento máximo declarado con el invernadero cerrado.
        Nieve del sitio: sobrecarga en terreno horizontal según zona de invierno y altitud (anejo E). Al límite = a menos de un 10 % de lo declarado.</p>
        ` : ''}
        ${this._notaEstimados(ctx)}
      </section>
    `;
  },

  _capitulos(ctx) {
    const { r, perfiles, categorias } = ctx;
    const perfil = id => perfiles.find(p => p.id === id);
    const cantidad = l => {
      if (l.traza.regla === 'porcentaje') return 'incluido';
      if (l.metros !== undefined) return `${this._num(l.kg, 0)} kg`;
      return `${this._num(l.cantidad, l.unidad === 'ud' ? 0 : 1)} ${this._esc(l.unidad)}`;
    };
    const capitulos = categorias.map((cat, i) => {
      const filas = r.lineas.filter(l => l.categoria === cat).map(l => {
        const p = perfil(l.ref);
        const detalle = p
          ? `<br><small>Perfil ${this._esc(p.medidas)}${p.espesor ? ' × ' + this._num(p.espesor, 2) + ' mm' : ''}${p.grado_acero ? ', acero ' + this._esc(p.grado_acero) : ''}${this._est(p.origen)}</small>`
          : '';
        return `<tr><td>${this._esc(l.texto || l.nombre)}${detalle}</td><td class="num">${cantidad(l)}${this._est(l.origen)}</td></tr>`;
      }).join('');
      return `
        <h3>2.${i + 1} ${this._esc(cat)}</h3>
        <table class="tabla">
          <tr><th>Descripción</th><th class="num">Cantidad</th></tr>
          ${filas}
        </table>`;
    }).join('');
    return `
      <section class="page">
        <h2>2. COMPOSICIÓN</h2>
        ${capitulos}
        <p><strong>Acero total:</strong> ${this._num(r.precio.kg_acero, 0)} kg (${this._num(r.precio.kg_acero_m2, 2)} kg/m²)${this._marca(ctx.estimado.acero)}.</p>
        ${this._notaEstimados(ctx)}
      </section>
    `;
  },

  _precios(ctx) {
    const { r, g, estimado } = ctx;
    const p = r.precio;
    const t = this._marca(estimado.total);
    const filas = Object.entries(p.categorias)
      .map(([cat, imp]) => `<tr><td>${this._esc(cat)}</td><td class="num">${this._eur(imp)}${this._marca(estimado.categoria(cat))}</td></tr>`).join('');
    const obra = p.obra
      ? `<tr><td>Montaje y obra local (${this._esc(p.obra.zona)})</td><td class="num">${this._eur(p.obra.total)}${this._est(p.obra.origen)}</td></tr>`
      : '';
    return `
      <section class="page">
        <h2>3. PRECIOS</h2>
        <p><strong>Superficie total:</strong> ${this._num(g.area)} m²</p>
        <table class="tabla precios">
          <tr><th>Descripción</th><th class="num">Importe (${this._esc(p.moneda)})</th></tr>
          ${filas}
          ${obra}
          <tr class="subtotal"><td>BASE IMPONIBLE</td><td class="num">${this._eur(p.base_imponible)}${t}</td></tr>
          <tr class="iva"><td>IVA ${this._num(p.iva_pct * 100, 0)} %</td><td class="num">${this._eur(p.iva)}${t}</td></tr>
          <tr class="total"><td>TOTAL PRESUPUESTO (IVA incluido)</td><td class="num">${this._eur(p.total)}${t}</td></tr>
        </table>
        <p>Precio medio sin IVA: <strong>${this._num(p.eur_m2, 2)} €/m²</strong>${t}.</p>
        ${estimado.total ? '<p class="nota">* Importes calculados con valores estimados, pendientes de confirmación por el fabricante.</p>' : ''}
        ${p.obra ? '' : '<p class="nota">No incluye montaje ni obra local.</p>'}
        <p class="nota">Importes sujetos a confirmación según datos definitivos de fábrica y condiciones del terreno.</p>
        ${estimado.total ? '' : this._notaEstimados(ctx)}
      </section>
    `;
  },

  _condiciones({ emp }) {
    const noIncluido = this._lista(emp.no_incluido);
    return `
      <section class="page">
        <h2>4. OTRAS CONDICIONES</h2>
        ${emp.plazo_de_entrega ? `<h3>4.1 Plazo de entrega</h3><p>${this._esc(emp.plazo_de_entrega)}</p>` : ''}
        ${emp.condiciones_de_pago ? `<h3>4.2 Forma de pago</h3><p>${this._esc(emp.condiciones_de_pago)}</p>` : ''}
        ${noIncluido.length ? `<h3>4.3 No incluido</h3><ul>${noIncluido.map(x => `<li>${this._esc(x)}</li>`).join('')}</ul>` : ''}
        <p class="disclaimer">
          Todas las imágenes y planos incluidos en este documento son orientativos y no contractuales.
        </p>
      </section>
    `;
  },

  _garantia({ emp, modelo }) {
    return `
      <section class="page">
        <h2>5. GARANTÍAS</h2>
        ${modelo.garantia_estructura ? `<p>Estructura: <strong>${this._num(modelo.garantia_estructura, 0)} años</strong>${this._est(modelo.origen)} por defectos de fabricación, sujeta a un montaje correcto y al uso conforme a las cargas declaradas.</p>` : ''}
        ${emp.garantias ? `<p>${this._esc(emp.garantias)}</p>` : ''}
        ${modelo.origen === 'estimado' && modelo.garantia_estructura ? '<p class="nota">* Valor estimado, pendiente de confirmación por el fabricante.</p>' : ''}
      </section>
    `;
  },

  _datosOferta({ emp, codigo, fecha }) {
    return `
      <section>
        <h3>Datos de la oferta</h3>
        <table class="tabla">
          <tr><td>Distribuidor</td><td>${this._esc(emp.nombre || '—')}</td></tr>
          <tr><td>Referencia</td><td>${this._esc(codigo)}</td></tr>
          <tr><td>Fecha</td><td>${fecha}</td></tr>
          <tr><td>Catálogo</td><td>${this._esc([emp.version_catalogo ? `versión ${emp.version_catalogo}` : '', emp.fecha].filter(Boolean).join(' · ') || '—')}</td></tr>
        </table>
      </section>
    `;
  }
};

if (typeof module !== 'undefined') module.exports = PROPUESTA;
