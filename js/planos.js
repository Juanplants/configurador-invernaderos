// ============================================================
// Generación de vistas del plano (SVG)
// ============================================================
// 4 vistas: planta, alzado frontal, alzado lateral, sección transversal.
// Sin layouts interiores ni overlays — vista estructural pura.

const PLANOS = {

  W: 900,
  H: 520,

  // ------------------------------------------------------------
  // UTILIDADES COMUNES
  // ------------------------------------------------------------
  _bordeYCajetin(titulo, modelo, calc, state, escala) {
    const { W, H } = this;
    const fecha = new Date().toLocaleDateString('es-ES');
    const parts = [];
    parts.push(`<rect x="8" y="8" width="${W-16}" height="${H-16}" fill="none" stroke="#333" stroke-width="1.5"/>`);
    parts.push(`<rect x="8" y="8" width="${W-16}" height="34" fill="#eceff1" stroke="#333" stroke-width="1.5"/>`);
    parts.push(`<text x="20" y="31" font-size="14" font-weight="700" fill="#1b5e20">CONFIGURADOR DE INVERNADEROS — ${titulo}</text>`);
    parts.push(`<text x="${W-20}" y="31" font-size="11" text-anchor="end" fill="#333">${fecha}</text>`);

    const cx = W - 260, cy = H - 70, cw = 250, ch = 60;
    parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="white" stroke="#333" stroke-width="1"/>`);
    parts.push(`<line x1="${cx}" y1="${cy+20}" x2="${cx+cw}" y2="${cy+20}" stroke="#333"/>`);
    parts.push(`<line x1="${cx+cw/2}" y1="${cy+20}" x2="${cx+cw/2}" y2="${cy+ch}" stroke="#333"/>`);
    parts.push(`<text x="${cx+6}" y="${cy+14}" font-size="10" font-weight="700">${modelo.nombre}</text>`);
    parts.push(`<text x="${cx+6}" y="${cy+33}" font-size="9" fill="#666">Escala aprox.</text>`);
    parts.push(`<text x="${cx+6}" y="${cy+46}" font-size="11">1 : ${escala.toFixed(0)}</text>`);
    parts.push(`<text x="${cx+cw/2+6}" y="${cy+33}" font-size="9" fill="#666">Superficie</text>`);
    parts.push(`<text x="${cx+cw/2+6}" y="${cy+46}" font-size="11" font-weight="700">${calc.area.toFixed(0)} m²</text>`);

    if (state.cliente || state.ubicacion || state.codigoProyecto) {
      const ix = 20, iy = H - 70, iw = 240, ih = 60;
      parts.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="white" stroke="#333" stroke-width="1"/>`);
      parts.push(`<line x1="${ix}" y1="${iy+20}" x2="${ix+iw}" y2="${iy+20}" stroke="#333"/>`);
      parts.push(`<text x="${ix+6}" y="${iy+14}" font-size="10" font-weight="700">CLIENTE / PROYECTO</text>`);
      parts.push(`<text x="${ix+6}" y="${iy+35}" font-size="11">${state.cliente || '—'}</text>`);
      parts.push(`<text x="${ix+6}" y="${iy+50}" font-size="10" fill="#666">${state.ubicacion || ''} ${state.codigoProyecto ? ' · ' + state.codigoProyecto : ''}</text>`);
    }

    return parts;
  },

  _acotar(parts, x1, y1, x2, y2, label, orientacion = 'h') {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="0.8"/>`);
    if (orientacion === 'h') {
      parts.push(`<line x1="${x1}" y1="${y1-5}" x2="${x1}" y2="${y1+5}" stroke="#333"/>`);
      parts.push(`<line x1="${x2}" y1="${y2-5}" x2="${x2}" y2="${y2+5}" stroke="#333"/>`);
      parts.push(`<text x="${(x1+x2)/2}" y="${y1+16}" text-anchor="middle" font-size="11" fill="#333">${label}</text>`);
    } else {
      parts.push(`<line x1="${x1-5}" y1="${y1}" x2="${x1+5}" y2="${y1}" stroke="#333"/>`);
      parts.push(`<line x1="${x2-5}" y1="${y2}" x2="${x2+5}" y2="${y2}" stroke="#333"/>`);
      parts.push(`<text x="${x1+10}" y="${(y1+y2)/2}" font-size="11" fill="#333" transform="rotate(90 ${x1+10} ${(y1+y2)/2})" text-anchor="middle">${label}</text>`);
    }
  },

  // ------------------------------------------------------------
  // 1. PLANTA
  // ------------------------------------------------------------
  planta(state, calc, modelo) {
    const { W, H } = this;
    const PAD_L = 60, PAD_R = 80, PAD_T = 60, PAD_B = 120;
    const drawW = W - PAD_L - PAD_R;
    const drawH = H - PAD_T - PAD_B;
    const scale = Math.min(drawW / calc.largo, drawH / calc.ancho);
    const planW = calc.largo * scale;
    const planH = calc.ancho * scale;
    const x0 = PAD_L + (drawW - planW) / 2;
    const y0 = PAD_T + (drawH - planH) / 2;

    const parts = this._bordeYCajetin('VISTA EN PLANTA', modelo, calc, state, (1/scale) * 100);

    const stripH = planH / state.numNaves;
    for (let i = 0; i < state.numNaves; i++) {
      parts.push(`<rect x="${x0}" y="${y0 + i*stripH}" width="${planW}" height="${stripH}" fill="${i%2===0 ? '#e8f5e9' : '#dcedc8'}" stroke="#2e7d32" stroke-width="1"/>`);
      const midY = y0 + i*stripH + stripH/2;
      parts.push(`<line x1="${x0}" y1="${midY}" x2="${x0+planW}" y2="${midY}" stroke="#2e7d32" stroke-width="0.5" stroke-dasharray="4 3" opacity="0.6"/>`);
    }

    // Pilares
    const tramoW = planW / state.numTramos;
    for (let i = 0; i <= state.numTramos; i++) {
      for (let j = 0; j <= state.numNaves; j++) {
        parts.push(`<circle cx="${x0 + i*tramoW}" cy="${y0 + j*stripH}" r="2.8" fill="#1b5e20"/>`);
      }
    }

    // Acotación
    this._acotar(parts, x0, y0 + planH + 24, x0 + planW, y0 + planH + 24,
      `Largo: ${calc.largo.toFixed(1)} m (${state.numTramos} × ${modelo.separacion_pilares} m)`, 'h');
    this._acotar(parts, x0 + planW + 24, y0, x0 + planW + 24, y0 + planH,
      `Ancho: ${calc.ancho.toFixed(1)} m`, 'v');

    // Flecha del norte
    parts.push(`<g transform="translate(${W-60}, 75)">
      <circle r="20" fill="white" stroke="#333"/>
      <path d="M0,-15 L7,10 L0,4 L-7,10 Z" fill="#333"/>
      <text y="28" text-anchor="middle" font-size="10">N</text>
    </g>`);

    return parts.join('');
  },

  // ------------------------------------------------------------
  // 2. ALZADO FRONTAL
  // ------------------------------------------------------------
  alzadoFrontal(state, calc, modelo) {
    const { W, H } = this;
    const PAD_L = 90, PAD_R = 80, PAD_T = 60, PAD_B = 130;
    const drawW = W - PAD_L - PAD_R;
    const drawH = H - PAD_T - PAD_B;

    const anchoReal = calc.ancho;
    const alturaReal = modelo.alto_cumbrera;
    const scale = Math.min(drawW / anchoReal, drawH / alturaReal);
    const planW = anchoReal * scale;
    const x0 = PAD_L + (drawW - planW) / 2;
    const ySuelo = PAD_T + drawH;
    const yCanal = ySuelo - modelo.alto_canal * scale;
    const yCumbrera = ySuelo - modelo.alto_cumbrera * scale;

    const parts = this._bordeYCajetin('ALZADO FRONTAL', modelo, calc, state, (1/scale) * 100);

    // Suelo
    parts.push(`<line x1="${x0-40}" y1="${ySuelo}" x2="${x0+planW+40}" y2="${ySuelo}" stroke="#333" stroke-width="2"/>`);
    for (let k = 0; k < 16; k++) {
      const hx = x0 - 35 + k * ((planW + 70)/15);
      parts.push(`<line x1="${hx}" y1="${ySuelo}" x2="${hx-6}" y2="${ySuelo+8}" stroke="#666" stroke-width="0.8"/>`);
    }

    const naveW = planW / state.numNaves;
    for (let i = 0; i < state.numNaves; i++) {
      const xL = x0 + i * naveW;
      const xR = xL + naveW;
      const xMid = (xL + xR) / 2;

      // Pilares laterales
      parts.push(`<line x1="${xL}" y1="${ySuelo}" x2="${xL}" y2="${yCanal}" stroke="#222" stroke-width="2.5"/>`);
      parts.push(`<line x1="${xR}" y1="${ySuelo}" x2="${xR}" y2="${yCanal}" stroke="#222" stroke-width="2.5"/>`);

      // Canal
      parts.push(`<line x1="${xL}" y1="${yCanal}" x2="${xR}" y2="${yCanal}" stroke="#333" stroke-width="2"/>`);

      // Cercha gótica
      parts.push(`<path d="M ${xL} ${yCanal} L ${xMid} ${yCumbrera} L ${xR} ${yCanal}" fill="#f1f8e9" stroke="#2e7d32" stroke-width="2"/>`);

      // Tirante
      const yTirante = yCanal + (yCumbrera - yCanal) * 0.15;
      parts.push(`<line x1="${xL+3}" y1="${yTirante}" x2="${xR-3}" y2="${yTirante}" stroke="#558b2f" stroke-width="0.8" stroke-dasharray="3 2"/>`);
    }

    this._acotar(parts, x0, ySuelo + 28, x0 + planW, ySuelo + 28,
      `Ancho total: ${anchoReal.toFixed(2)} m (${state.numNaves} × ${modelo.ancho_nave} m)`, 'h');
    this._acotar(parts, x0 - 28, yCanal, x0 - 28, ySuelo,
      `H canal: ${modelo.alto_canal} m`, 'v');
    this._acotar(parts, x0 - 50, yCumbrera, x0 - 50, ySuelo,
      `H cumbrera: ${modelo.alto_cumbrera} m`, 'v');

    parts.push(`<text x="${x0 + planW/2}" y="${yCumbrera - 10}" text-anchor="middle" font-size="10" fill="#1b5e20" font-style="italic">Cercha — perfil estructural</text>`);

    return parts.join('');
  },

  // ------------------------------------------------------------
  // 3. ALZADO LATERAL
  // ------------------------------------------------------------
  alzadoLateral(state, calc, modelo) {
    const { W, H } = this;
    const PAD_L = 90, PAD_R = 80, PAD_T = 60, PAD_B = 130;
    const drawW = W - PAD_L - PAD_R;
    const drawH = H - PAD_T - PAD_B;

    const largoReal = calc.largo;
    const alturaReal = modelo.alto_cumbrera;
    const scale = Math.min(drawW / largoReal, drawH / alturaReal);
    const planW = largoReal * scale;
    const x0 = PAD_L + (drawW - planW) / 2;
    const ySuelo = PAD_T + drawH;
    const yCanal = ySuelo - modelo.alto_canal * scale;
    const yCumbrera = ySuelo - modelo.alto_cumbrera * scale;

    const parts = this._bordeYCajetin('ALZADO LATERAL', modelo, calc, state, (1/scale) * 100);

    parts.push(`<line x1="${x0-40}" y1="${ySuelo}" x2="${x0+planW+40}" y2="${ySuelo}" stroke="#333" stroke-width="2"/>`);
    for (let k = 0; k < 18; k++) {
      const hx = x0 - 35 + k * ((planW + 70)/17);
      parts.push(`<line x1="${hx}" y1="${ySuelo}" x2="${hx-6}" y2="${ySuelo+8}" stroke="#666" stroke-width="0.8"/>`);
    }

    parts.push(`<rect x="${x0}" y="${yCanal}" width="${planW}" height="${ySuelo - yCanal}" fill="#fafff4" stroke="#2e7d32" stroke-width="1.5"/>`);
    parts.push(`<line x1="${x0}" y1="${yCumbrera}" x2="${x0+planW}" y2="${yCumbrera}" stroke="#2e7d32" stroke-width="1.5"/>`);
    parts.push(`<line x1="${x0}" y1="${yCanal}" x2="${x0}" y2="${yCumbrera}" stroke="#2e7d32" stroke-width="1.5"/>`);
    parts.push(`<line x1="${x0+planW}" y1="${yCanal}" x2="${x0+planW}" y2="${yCumbrera}" stroke="#2e7d32" stroke-width="1.5"/>`);

    const tramoW = planW / state.numTramos;
    for (let i = 0; i <= state.numTramos; i++) {
      const px = x0 + i * tramoW;
      parts.push(`<line x1="${px}" y1="${yCanal}" x2="${px}" y2="${ySuelo}" stroke="#222" stroke-width="2.2"/>`);
      if (i < state.numTramos) {
        parts.push(`<line x1="${px}" y1="${yCanal-3}" x2="${px+tramoW}" y2="${yCanal-3}" stroke="#2e7d32" stroke-width="0.6" stroke-dasharray="2 2"/>`);
      }
    }

    this._acotar(parts, x0, ySuelo + 28, x0 + planW, ySuelo + 28,
      `Largo total: ${largoReal.toFixed(1)} m (${state.numTramos} tramos × ${modelo.separacion_pilares} m)`, 'h');
    this._acotar(parts, x0 - 28, yCanal, x0 - 28, ySuelo,
      `H canal: ${modelo.alto_canal} m`, 'v');
    this._acotar(parts, x0 - 50, yCumbrera, x0 - 50, ySuelo,
      `H cumbrera: ${modelo.alto_cumbrera} m`, 'v');

    if (tramoW > 40) {
      parts.push(`<text x="${x0 + tramoW/2}" y="${ySuelo - 8}" text-anchor="middle" font-size="9" fill="#666">${modelo.separacion_pilares} m</text>`);
    }

    return parts.join('');
  },

  // ------------------------------------------------------------
  // 4. SECCIÓN TRANSVERSAL
  // ------------------------------------------------------------
  seccion(state, calc, modelo) {
    const { W, H } = this;
    const PAD_L = 100, PAD_R = 100, PAD_T = 60, PAD_B = 140;
    const drawW = W - PAD_L - PAD_R;
    const drawH = H - PAD_T - PAD_B;

    const anchoReal = modelo.ancho_nave;
    const alturaReal = modelo.alto_cumbrera;
    const scale = Math.min(drawW / anchoReal, drawH / alturaReal);
    const planW = anchoReal * scale;
    const x0 = PAD_L + (drawW - planW) / 2;
    const ySuelo = PAD_T + drawH;
    const yCanal = ySuelo - modelo.alto_canal * scale;
    const yCumbrera = ySuelo - modelo.alto_cumbrera * scale;
    const xL = x0, xR = x0 + planW, xMid = (xL + xR) / 2;

    const parts = this._bordeYCajetin('SECCIÓN TRANSVERSAL — DETALLE CERCHA', modelo, calc, state, (1/scale) * 100);

    // Suelo con hatching
    parts.push(`<line x1="${xL-60}" y1="${ySuelo}" x2="${xR+60}" y2="${ySuelo}" stroke="#333" stroke-width="2"/>`);
    for (let k = 0; k < 20; k++) {
      const hx = xL - 55 + k * ((planW + 110)/19);
      parts.push(`<line x1="${hx}" y1="${ySuelo}" x2="${hx-6}" y2="${ySuelo+10}" stroke="#666" stroke-width="0.8"/>`);
    }

    // Cimentación
    parts.push(`<rect x="${xL-15}" y="${ySuelo}" width="30" height="14" fill="#ddd" stroke="#666" stroke-width="0.8"/>`);
    parts.push(`<rect x="${xR-15}" y="${ySuelo}" width="30" height="14" fill="#ddd" stroke="#666" stroke-width="0.8"/>`);
    parts.push(`<text x="${xL}" y="${ySuelo+24}" text-anchor="middle" font-size="8" fill="#666">cimentación</text>`);
    parts.push(`<text x="${xR}" y="${ySuelo+24}" text-anchor="middle" font-size="8" fill="#666">cimentación</text>`);

    // Pilares
    parts.push(`<rect x="${xL-4}" y="${yCanal}" width="8" height="${ySuelo-yCanal}" fill="#424242" stroke="#000" stroke-width="0.8"/>`);
    parts.push(`<rect x="${xR-4}" y="${yCanal}" width="8" height="${ySuelo-yCanal}" fill="#424242" stroke="#000" stroke-width="0.8"/>`);

    // Canal
    parts.push(`<rect x="${xL-6}" y="${yCanal-8}" width="12" height="8" fill="#666"/>`);
    parts.push(`<rect x="${xR-6}" y="${yCanal-8}" width="12" height="8" fill="#666"/>`);

    // Cercha
    parts.push(`<path d="M ${xL} ${yCanal} L ${xMid} ${yCumbrera} L ${xR} ${yCanal}" fill="none" stroke="#1b5e20" stroke-width="3"/>`);

    // Barra de cultivo
    const yBarra = yCanal - (yCanal - yCumbrera) * 0.35;
    parts.push(`<line x1="${xL+10}" y1="${yBarra}" x2="${xR-10}" y2="${yBarra}" stroke="#558b2f" stroke-width="2"/>`);
    parts.push(`<text x="${xR+8}" y="${yBarra+4}" font-size="9" fill="#558b2f">barra cultivo Ø32</text>`);

    // Tirante
    const yTirante = yCanal - 3;
    parts.push(`<line x1="${xL+4}" y1="${yTirante}" x2="${xR-4}" y2="${yTirante}" stroke="#558b2f" stroke-width="1.2" stroke-dasharray="4 2"/>`);
    parts.push(`<text x="${xR+8}" y="${yTirante+4}" font-size="9" fill="#558b2f">tirante Ø32</text>`);

    parts.push(`<text x="${xMid}" y="${yCumbrera-8}" text-anchor="middle" font-size="10" font-weight="700" fill="#1b5e20">cumbrera Ø60×2</text>`);
    parts.push(`<text x="${(xL+xMid)/2-10}" y="${(yCanal+yCumbrera)/2-4}" font-size="9" fill="#1b5e20">arco Ø60×1,5</text>`);
    parts.push(`<text x="${xL-50}" y="${(yCanal+ySuelo)/2}" font-size="9" fill="#333" text-anchor="end">pilar 80×80×2</text>`);
    parts.push(`<line x1="${xL-48}" y1="${(yCanal+ySuelo)/2-3}" x2="${xL-4}" y2="${(yCanal+ySuelo)/2-3}" stroke="#999" stroke-width="0.6"/>`);

    this._acotar(parts, xL, ySuelo + 38, xR, ySuelo + 38, `Ancho capilla: ${anchoReal.toFixed(2)} m`, 'h');
    this._acotar(parts, xL - 30, yCanal, xL - 30, ySuelo, `${modelo.alto_canal} m`, 'v');
    this._acotar(parts, xL - 55, yCumbrera, xL - 55, ySuelo, `${modelo.alto_cumbrera} m`, 'v');
    this._acotar(parts, xR + 30, yCumbrera, xR + 30, yCanal, `${(modelo.alto_cumbrera - modelo.alto_canal).toFixed(2)} m`, 'v');

    return parts.join('');
  }
};
