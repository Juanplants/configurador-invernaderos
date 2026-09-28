// ============================================================
// Cálculos estructurales del invernadero
// ============================================================
// Solo dimensiones, geometría y precio. Equipamiento,
// cultivo, consumos y ROI quedaron fuera del alcance v0.3
// hasta estandarizar la base estructural.

const CALCULOS = {

  estructura(state, modelo) {
    const largo = state.numTramos * modelo.separacion_pilares;
    const ancho = state.numNaves * modelo.ancho_nave;
    const area = largo * ancho;
    const numPilares = (state.numTramos + 1) * (state.numNaves + 1);
    const numCerchas = (state.numTramos + 1) * state.numNaves;
    const volumen = area * ((modelo.alto_canal + modelo.alto_cumbrera) / 2);
    const perimetro = 2 * (largo + ancho);

    return { largo, ancho, area, numPilares, numCerchas, volumen, perimetro };
  },

  precio(area, modelo, opcionesActivas) {
    const lineas = [];
    const base = area * modelo.precio_base_m2;
    lineas.push({ concepto: 'Estructura de invernadero', m2: area, precio: base, categoria: 'Estructura' });

    const agruparPor = { 'Estructura': base };
    for (const cat of OPCIONES) {
      for (const opt of cat.items) {
        if (opcionesActivas.has(opt.id)) {
          const subtotal = area * opt.precio_m2;
          lineas.push({ concepto: opt.nombre, m2: area, precio: subtotal, categoria: cat.categoria });
          agruparPor[cat.categoria] = (agruparPor[cat.categoria] || 0) + subtotal;
        }
      }
    }
    const total = lineas.reduce((s, l) => s + l.precio, 0);
    return { lineas, subtotalesCategoria: agruparPor, total };
  }
};
