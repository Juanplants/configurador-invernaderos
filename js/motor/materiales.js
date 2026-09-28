// ============================================================
// 3. Lista de materiales
// ============================================================
// Para cada componente del modelo y de las opciones elegidas aplica
// su regla y devuelve cantidad, unidad, metros y kg (si es acero),
// precio unitario, importe y la traza del cálculo ("ver cálculo").

(function (raiz) {
  const EXPR = raiz.MOTOR?.expresiones || (typeof require !== 'undefined' && require('./expresiones.js'));

  const r1 = (x) => Math.round(x * 10) / 10;

  // "A|B" → variante según la posición del modelo en la columna Modelos
  function variante(valor, idx) {
    if (valor === undefined || valor === null) return valor;
    if (typeof valor !== 'string' || !valor.includes('|')) return valor;
    const partes = valor.split('|').map(s => s.trim());
    return partes[Math.min(idx, partes.length - 1)];
  }

  function buscar(catalogo, id) {
    if (!id) return null;
    for (const hoja of ['perfiles', 'cubiertas', 'equipos']) {
      const f = (catalogo[hoja] || []).find(x => x.id === id);
      if (f) return { hoja, fila: f };
    }
    return null;
  }

  // Componentes que entran en el proyecto: obligatorios sin grupo, el elegido
  // de cada grupo (o ninguno si la selección es null) y los opcionales marcados.
  function componentesActivos(catalogo, modelo, proyecto) {
    const sel = proyecto.seleccion || {};
    const opc = new Set(proyecto.opcionales || []);
    const delModelo = catalogo.componentes.filter(c =>
      String(c.modelos || '').split(';').map(s => s.trim()).includes(modelo.id));
    const grupos = {};
    for (const c of delModelo) {
      if (c.grupo_alternativas) (grupos[c.grupo_alternativas] ||= []).push(c);
    }
    const elegidos = {};
    for (const [g, comps] of Object.entries(grupos)) {
      elegidos[g] = g in sel ? sel[g] : comps[0].id; // null = ninguna opción
    }
    const activos = delModelo.filter(c => {
      if (c.grupo_alternativas) return elegidos[c.grupo_alternativas] === c.id;
      if (c.tipo === 'opcional') return opc.has(c.id);
      return true;
    });
    return { activos, elegidos, grupos };
  }

  function calcular(catalogo, modelo, proyecto, g, vent, ventanas) {
    const { activos } = componentesActivos(catalogo, modelo, proyecto);
    const vars = Object.assign({}, g, { superficie_ventanas: vent.superficie_ventanas });
    const lineas = [];
    const errores = [];

    for (const c of activos) {
      const idx = String(c.modelos).split(';').map(s => s.trim()).indexOf(modelo.id);
      const refId = variante(c.ref, idx);
      const ref = buscar(catalogo, refId);
      const factorExpr = variante(c.factor, idx);
      const traza = { regla: c.regla, factor: factorExpr };
      let base = 0;
      try {
        const f = (factorExpr !== undefined && factorExpr !== '') ? EXPR.evaluar(factorExpr, vars) : 1;
        switch (c.regla) {
          case 'por_pilar': base = g.pilares * f; traza.calculo = `${g.pilares} pilares × ${r1(f)}`; break;
          case 'por_pilar_hastial': base = g.pilares_hastial * f; traza.calculo = `${g.pilares_hastial} pilares de hastial × ${r1(f)}`; break;
          case 'por_portico_nave': base = g.porticos * g.naves * f; traza.calculo = `${g.porticos} pórticos × ${g.naves} naves × ${(Math.round(f * 100) / 100)}`; break;
          case 'lineas_x_longitud': base = f * g.largo; traza.calculo = `${r1(f)} líneas × ${r1(g.largo)} m`; break;
          case 'superficie_cubierta': base = g.area_cubierta * f; traza.calculo = `${r1(g.area_cubierta)} m² × ${f}`; break;
          case 'superficie_cerramiento': base = g.area_cerramiento * f; traza.calculo = `${r1(g.area_cerramiento)} m² × ${f}`; break;
          case 'perimetro': base = g.perimetro * f; traza.calculo = `${r1(g.perimetro)} m × ${f}`; break;
          case 'fija': base = f; traza.calculo = `${factorExpr} = ${f}`; break;
          case 'formula': base = EXPR.evaluar(variante(c.formula_avanzada, idx), vars); traza.calculo = `${variante(c.formula_avanzada, idx)} = ${r1(base)}`; break;
          case 'por_ventana': {
            const cap = ref && ref.fila.capacidad ? ref.fila.capacidad : Infinity;
            const porLinea = g.long_ventana_cenital > 0 ? Math.ceil(g.long_ventana_cenital / cap) : 0;
            base = g.naves * vent.lineas_cenital * porLinea;
            traza.calculo = `${g.naves} naves × ${vent.lineas_cenital} líneas × ⌈${r1(g.long_ventana_cenital)} m ÷ ${cap} m⌉`;
            break;
          }
          case 'porcentaje': base = f; traza.calculo = `${f * 100} % de las partidas en kg de ${c.categoria}`; break;
          default: throw new Error(`Regla desconocida "${c.regla}"`);
        }
      } catch (e) {
        errores.push(`${c.id} ${c.nombre}: ${e.message}`);
        continue;
      }

      const linea = {
        id: c.id, categoria: c.categoria, nombre: c.nombre, unidad: c.unidad,
        ref: refId || null, origen: ref ? ref.fila.origen : c.origen, texto: c.texto_propuesta || '',
        traza
      };

      if (c.regla === 'porcentaje') {
        linea.cantidad = base; // se valora después
      } else if (c.unidad === 'kg' && ref && ref.hoja === 'perfiles') {
        linea.metros = base;
        linea.kg = base * ref.fila.peso;
        linea.cantidad = linea.kg;
        linea.precio_unitario = ref.fila.precio;
        linea.importe = ref.fila.unidad_precio === 'm' ? linea.metros * ref.fila.precio : linea.kg * ref.fila.precio;
        traza.calculo += ` = ${r1(base)} m × ${ref.fila.peso} kg/m`;
      } else {
        linea.cantidad = (c.unidad === 'ud') ? Math.ceil(base - 1e-9) : base;
        if (c.unidad === 'kg') linea.kg = linea.cantidad;
        const precio = (ref && ref.fila.precio !== undefined) ? ref.fila.precio : c.precio_unitario;
        linea.precio_unitario = precio;
        linea.importe = (precio !== undefined && precio !== null && precio !== '') ? linea.cantidad * precio : null;
      }
      lineas.push(linea);
    }

    // Partidas en porcentaje: sobre el importe de las partidas en kg de su categoría
    for (const l of lineas.filter(x => x.traza.regla === 'porcentaje')) {
      const base = lineas.filter(x => x.categoria === l.categoria && x.unidad === 'kg' && x !== l)
        .reduce((s, x) => s + (x.importe || 0), 0);
      l.precio_unitario = base;
      l.importe = l.cantidad * base;
    }
    return { lineas, errores };
  }

  const API = { calcular, componentesActivos, buscar, variante };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, { materiales: API });
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
