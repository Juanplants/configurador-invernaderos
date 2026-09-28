// ============================================================
// Generación de la propuesta comercial (HTML imprimible a PDF)
// ============================================================
// Versión estructural pura. Numeración de capítulos coherente
// con el índice. Título y familia se ajustan al modelo elegido.

const PROPUESTA = {

  generar(state, modelo, calc, precio, planos) {
    const fecha = new Date().toLocaleDateString('es-ES');
    const codigo = state.codigoProyecto || 'PROP-' + new Date().toISOString().slice(0,10).replace(/-/g,'');
    const cliente = state.cliente || 'Cliente no especificado';
    const ubicacion = state.ubicacion || '—';
    const familiaNombre = this._familiaNombre(modelo);

    const html = `
      <div class="propuesta">
        ${this._portada(codigo, cliente, ubicacion, fecha, familiaNombre)}
        ${this._indice()}
        ${this._antecedentes(modelo, calc, cliente, ubicacion)}
        ${this._dimensiones(state, modelo, calc)}
        ${this._planos(planos)}
        ${this._normativa(modelo)}
        ${this._estructura(modelo)}
        ${this._recubrimiento(modelo)}
        ${this._especificaciones()}
        ${this._precios(calc, precio)}
        ${this._condiciones()}
        ${this._garantia()}
      </div>
    `;
    return html;
  },

  _familiaNombre(modelo) {
    const map = {
      'multitunel': 'MULTITÚNEL',
      'venlo': 'VENLO',
      'parral': 'PARRAL'
    };
    return map[modelo.familia] || 'INVERNADERO';
  },

  // ---------- Secciones ----------
  _portada(codigo, cliente, ubicacion, fecha, familiaNombre) {
    return `
      <section class="page portada">
        <div class="logo-top">CONFIGURADOR INVERNADEROS</div>
        <div class="meta">
          <div><strong>${codigo}</strong></div>
          <div>Ed: 00</div>
          <div>${cliente}</div>
          <div>${ubicacion}</div>
          <div>${fecha}</div>
        </div>
        <div class="titulo">
          <h1>PRESUPUESTO DE INVERNADERO ${familiaNombre}</h1>
          <h2>Descripción Técnica</h2>
        </div>
        <div class="disclaimer-portada">
          Las imágenes y planos no son contractuales
        </div>
      </section>
    `;
  },

  _indice() {
    return `
      <section class="page">
        <h2>ÍNDICE</h2>
        <ol class="indice">
          <li>ESTRUCTURA Y RECUBRIMIENTO
            <ol>
              <li>Antecedentes del proyecto</li>
              <li>Dimensiones del invernadero</li>
              <li>Planos del proyecto (planta, alzados y sección)</li>
              <li>Normativa aplicable y cargas de cálculo</li>
              <li>Cimentación</li>
              <li>Pilares, canal y cerchas</li>
              <li>Recubrimiento</li>
              <li>Ventilación cenital</li>
            </ol>
          </li>
          <li>ESPECIFICACIONES TÉCNICAS RESUMIDAS</li>
          <li>PRECIOS</li>
          <li>OTRAS CONDICIONES</li>
          <li>GARANTÍAS</li>
        </ol>
      </section>
    `;
  },

  _antecedentes(modelo, calc, cliente, ubicacion) {
    return `
      <section class="page">
        <h2>1. ESTRUCTURA Y RECUBRIMIENTO</h2>
        <h3>1.1 Antecedentes del proyecto</h3>
        <p>
          A petición de <strong>${cliente}</strong>, ubicado en <strong>${ubicacion}</strong>,
          se presenta la siguiente propuesta técnica y económica para la instalación de un
          invernadero <strong>${modelo.nombre.toLowerCase()}</strong> con una superficie total
          de <strong>${calc.area.toFixed(0)} m²</strong>.
        </p>
        <p>${modelo.descripcion}</p>
      </section>
    `;
  },

  _dimensiones(state, modelo, calc) {
    return `
      <section>
        <h3>1.2 Dimensiones del invernadero</h3>
        <table class="tabla">
          <tr><th>Parámetro</th><th>Valor</th></tr>
          <tr><td>Ancho máx.</td><td>${calc.ancho.toFixed(2)} m</td></tr>
          <tr><td>Largo máx.</td><td>${calc.largo.toFixed(2)} m</td></tr>
          <tr><td>Nº de capillas</td><td>${state.numNaves}</td></tr>
          <tr><td>Ancho de capilla</td><td>${modelo.ancho_nave.toFixed(2)} m</td></tr>
          <tr><td>Altura a canal</td><td>${modelo.alto_canal.toFixed(2)} m</td></tr>
          <tr><td>Altura cumbrera máx.</td><td>${modelo.alto_cumbrera.toFixed(2)} m</td></tr>
          <tr><td>Separación entre pilares</td><td>${modelo.separacion_pilares.toFixed(2)} m</td></tr>
          <tr><td>Separación entre cerchas</td><td>${modelo.separacion_pilares.toFixed(2)} m</td></tr>
          <tr><td>Nº de pilares</td><td>${calc.numPilares}</td></tr>
          <tr><td>Nº de cerchas</td><td>${calc.numCerchas}</td></tr>
          <tr class="total"><td>Superficie total invernadero</td><td>${calc.area.toFixed(2)} m²</td></tr>
        </table>
      </section>
    `;
  },

  _planos(planos) {
    if (!planos) return '';
    const pagina = (titulo, svgContent) => `
      <section class="page planos-page">
        <h3>${titulo}</h3>
        <div class="plano-wrap">
          <svg viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>
        </div>
      </section>
    `;
    return `
      <section class="page">
        <h3>1.3 Planos del proyecto</h3>
        <p>
          A continuación se incluyen los planos del invernadero con las cuatro
          vistas principales: planta general, alzado frontal, alzado lateral y
          sección transversal con detalle de una cercha. Todas las cotas están
          expresadas en metros. Las vistas son orientativas y no contractuales.
        </p>
        <h4>Planta general</h4>
        <div class="plano-wrap">
          <svg viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">${planos.planta}</svg>
        </div>
      </section>
      ${pagina('Alzado frontal', planos.alzadoFrontal)}
      ${pagina('Alzado lateral', planos.alzadoLateral)}
      ${pagina('Sección transversal — detalle de cercha', planos.seccion)}
    `;
  },

  _normativa(modelo) {
    const s = modelo.specs;
    return `
      <section>
        <h3>1.4 Normativa aplicable y cargas de cálculo</h3>
        <ul>${s.normativa.map(n => `<li>${n}</li>`).join('')}</ul>
        <h4>Cargas consideradas</h4>
        <table class="tabla">
          <tr><td>Viento (10 min a 10 m)</td><td>${s.cargas.viento_medio}</td></tr>
          <tr><td>Viento máx. con plásticos y ventanas cerradas</td><td>${s.cargas.viento_max_cerrado}</td></tr>
          <tr><td>Viento máx. sin plásticos</td><td>${s.cargas.viento_max_abierto}</td></tr>
          <tr><td>Cultivo</td><td>${s.cargas.cultivo}</td></tr>
          <tr><td>Equipamiento</td><td>${s.cargas.equipamiento}</td></tr>
          <tr><td>Nieve</td><td>${s.cargas.nieve}</td></tr>
        </table>
        <h3>1.5 Cimentación</h3>
        <table class="tabla">
          <tr><td>Resistencia del terreno</td><td>${s.cimentacion.resistencia_terreno}</td></tr>
          <tr><td>Ángulo de fricción del suelo</td><td>${s.cimentacion.angulo_frotamiento}</td></tr>
          <tr><td>Compactación</td><td>${s.cimentacion.compactacion}</td></tr>
        </table>
      </section>
    `;
  },

  _estructura(modelo) {
    const s = modelo.specs;
    return `
      <section class="page">
        <h3>1.6 Pilares, canal y cerchas</h3>
        <table class="tabla">
          <tr><th colspan="2">PILARES</th></tr>
          <tr><td>Sección</td><td>${s.pilares.seccion}</td></tr>
          <tr><td>Espesor</td><td>${s.pilares.espesor}</td></tr>
          <tr><td>Protección</td><td>${s.pilares.proteccion}</td></tr>

          <tr><th colspan="2">CANAL</th></tr>
          <tr><td>Tipo</td><td>${s.canal.tipo}</td></tr>
          <tr><td>Desarrollo</td><td>${s.canal.desarrollo}</td></tr>
          <tr><td>Espesor</td><td>${s.canal.espesor}</td></tr>
          <tr><td>Galvanizado</td><td>${s.canal.galvanizado}</td></tr>

          <tr><th colspan="2">CERCHAS</th></tr>
          <tr><td>Forma</td><td>${s.cerchas.forma}</td></tr>
          <tr><td>Cumbrera</td><td>${s.cerchas.cumbrera}</td></tr>
          <tr><td>Arco</td><td>${s.cerchas.arco}</td></tr>
          <tr><td>Barra de cultivo</td><td>${s.cerchas.barra_cultivo}</td></tr>
          <tr><td>Tirantes</td><td>${s.cerchas.tirantes}</td></tr>
        </table>

        <h3>1.8 Ventilación cenital</h3>
        <table class="tabla">
          <tr><td>Tipo</td><td>${s.ventilacion.tipo}</td></tr>
          <tr><td>Brazo</td><td>${s.ventilacion.brazo}</td></tr>
          <tr><td>Motor</td><td>${s.ventilacion.motor}</td></tr>
        </table>
      </section>
    `;
  },

  _recubrimiento(modelo) {
    const r = modelo.specs.recubrimiento;
    return `
      <section>
        <h3>1.7 Recubrimiento</h3>
        <table class="tabla">
          <tr><td>Tipo de techo</td><td>${r.techo}</td></tr>
          <tr><td>Plástico / material</td><td>${r.plastico}</td></tr>
          <tr><td>Transmisión de luz</td><td>${r.transmision_luz}</td></tr>
          <tr><td>Eficiencia térmica</td><td>${r.eficiencia_termica}</td></tr>
        </table>
      </section>
    `;
  },

  _especificaciones() {
    return `
      <section class="page">
        <h2>2. ESPECIFICACIONES TÉCNICAS RESUMIDAS</h2>
        <p>Las especificaciones cumplen con la normativa europea vigente:</p>
        <ul>
          <li>Acero estructural <strong>S275JR / S235JR</strong> según UNE-EN 10025-1:2006.</li>
          <li>Galvanizado en caliente según UNE-EN ISO 1461:2010.</li>
          <li>Tornillería con recubrimiento Zinc + Níquel.</li>
          <li>Diseño estructural calculado con software de cálculo de estructuras metálicas.</li>
          <li>Plástico de cubierta con garantía según ficha técnica del fabricante.</li>
        </ul>
      </section>
    `;
  },

  _precios(calc, precio) {
    const fmt = n => n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €';
    const subtotales = precio.subtotalesCategoria;
    let html = `
      <section class="page">
        <h2>3. PRECIOS</h2>
        <p><strong>Superficie total:</strong> ${calc.area.toFixed(2)} m²</p>
        <table class="tabla precios">
          <tr><th>Descripción</th><th class="num">Importe (EUR)</th></tr>
    `;
    for (const [cat, importe] of Object.entries(subtotales)) {
      html += `<tr><td>${cat}</td><td class="num">${fmt(importe)}</td></tr>`;
    }
    html += `
          <tr class="subtotal"><td>SUBTOTAL</td><td class="num">${fmt(precio.total)}</td></tr>
          <tr class="iva"><td>IVA 21 %</td><td class="num">${fmt(precio.total * 0.21)}</td></tr>
          <tr class="total"><td>TOTAL PRESUPUESTO (IVA incluido)</td><td class="num">${fmt(precio.total * 1.21)}</td></tr>
        </table>
        <p class="nota">
          Importes sujetos a confirmación según datos definitivos de fábrica y condiciones del terreno.
        </p>
      </section>
    `;
    return html;
  },

  _condiciones() {
    return `
      <section class="page">
        <h2>4. OTRAS CONDICIONES</h2>
        <h3>4.1 Transporte</h3>
        <p>CIF puerto de destino en España o franco fábrica, según Incoterm pactado.</p>
        <h3>4.2 Plazo de entrega</h3>
        <p>10-12 semanas desde confirmación de pedido y recepción del 30 % de anticipo.</p>
        <h3>4.3 Forma de pago</h3>
        <ul>
          <li><strong>Materiales:</strong> 30 % a la firma del contrato, 70 % una semana antes de cada carga.</li>
          <li><strong>Mano de obra:</strong> 30 % a la firma, 70 % mediante certificaciones parciales cada 15 días.</li>
        </ul>
        <h3>4.4 No incluido</h3>
        <ul>
          <li>Obra civil.</li>
          <li>Permisos, licencias, proyecto o legalizaciones.</li>
          <li>Acometidas eléctricas, hidráulicas y de gas hasta el invernadero.</li>
          <li>Tuberías y colectores de bajantes pluviales.</li>
          <li>Equipamiento interior (climatización, riego, mesas, iluminación, control).</li>
        </ul>
        <p class="disclaimer">
          Todas las imágenes y planos incluidos en este documento son orientativos y no contractuales.
        </p>
      </section>
    `;
  },

  _garantia() {
    return `
      <section class="page">
        <h2>5. GARANTÍAS</h2>
        <h3>5.1 Estructura</h3>
        <p>La estructura cuenta con garantía por defectos de fabricación durante 10 años desde la fecha de entrega, sujeta a un montaje correcto y al uso conforme a las cargas de cálculo declaradas.</p>
        <h3>5.2 Plástico de cubierta</h3>
        <p>Las láminas se suministran con garantía según la ficha técnica del fabricante
        (habitualmente 30-48 meses según radiación del emplazamiento).</p>
        <p>En caso de degradación prematura, la indemnización se aplica conforme a:</p>
        <p class="formula">D % = (GL − AL) / GL × 100</p>
        <p>donde GL es el periodo de garantía (meses) y AL la vida útil real al fallar.</p>
      </section>
    `;
  }
};
