// ============================================================
// Juego de planos: qué hojas hay, en qué orden y con qué número
// ============================================================
// const j = PLANOS_A3.juego(datos)
//   datos: los de cada hoja (g, modelo, empresa, proyecto, fecha, puertas,
//          ventana, lateral, orientacion, parcela o terreno)
// → [{ clave, vistas, titulo, archivo, numero, hoja }] en orden; `hoja` se
//   dibuja al pedirla (y se guarda). `vistas`: pestañas de la app que la muestran.
//
// Alzado frontal y sección van en una hoja A3 si caben los dos a la misma
// escala (PLANOS_A3.alzadoYSeccion); si no, en hojas separadas. El
// emplazamiento, solo con parcela (rectángulo o del Catastro). Números
// correlativos: 01 planta, 02 alzado frontal (y sección), 03 alzado lateral,
// 04 sección si va aparte, y el emplazamiento el último.

(function (raiz) {
  const req = (n) => (typeof require !== 'undefined' ? require(n) : null);
  const P = raiz.PLANOS_A3 || {};
  const PLANTA = P.planta ? P : req('./planta.js');
  const TRANSVERSAL = P.alzadoYSeccion ? P : req('./transversal.js');
  const LATERAL = P.alzadoLateral ? P : req('./lateral.js');
  const EMPLAZAMIENTO = P.emplazamiento ? P : req('./emplazamiento.js');

  const HOJAS = {
    planta:        { titulo: 'Planta general', archivo: 'planta', vistas: ['planta'], dibujar: (d) => PLANTA.planta(d) },
    alzadoSeccion: { titulo: 'Alzado frontal y sección transversal', archivo: 'alzado-frontal-y-seccion', vistas: ['alzadoFrontal', 'seccion'] },
    alzadoFrontal: { titulo: 'Alzado frontal', archivo: 'alzado-frontal', vistas: ['alzadoFrontal'], dibujar: (d) => TRANSVERSAL.alzadoFrontal(d) },
    alzadoLateral: { titulo: 'Alzado lateral', archivo: 'alzado-lateral', vistas: ['alzadoLateral'], dibujar: (d) => LATERAL.alzadoLateral(d) },
    seccion:       { titulo: 'Sección transversal', archivo: 'seccion', vistas: ['seccion'], dibujar: (d) => TRANSVERSAL.seccion(d) },
    emplazamiento: { titulo: 'Emplazamiento', archivo: 'emplazamiento', vistas: ['emplazamiento'], dibujar: (d) => EMPLAZAMIENTO.emplazamiento(d) }
  };

  function juego(datos) {
    // La hoja conjunta se dibuja para saber si cabe: se guarda (con su número, 02)
    const conjunta = TRANSVERSAL.alzadoYSeccion(Object.assign({}, datos, { numero: '02' }));
    const claves = ['planta'].concat(conjunta ? ['alzadoSeccion'] : ['alzadoFrontal'], ['alzadoLateral'],
      conjunta ? [] : ['seccion'], (datos.parcela || (datos.terreno && datos.terreno.anillos)) ? ['emplazamiento'] : []);
    return claves.map((clave, i) => {
      const numero = String(i + 1).padStart(2, '0');
      const def = HOJAS[clave];
      let hoja = clave === 'alzadoSeccion' ? conjunta : undefined;
      return {
        clave, numero, titulo: def.titulo, vistas: def.vistas.slice(), archivo: `${numero}-${def.archivo}`,
        get hoja() {
          if (hoja === undefined) hoja = def.dibujar(Object.assign({}, datos, { numero }));
          return hoja;
        }
      };
    });
  }
  // La hoja que muestra una pestaña (vista) de la app
  const deVista = (j, vista) => j.find(h => h.vistas.includes(vista)) || null;

  const API = { juego, deVista, HOJAS_JUEGO: HOJAS };
  raiz.PLANOS_A3 = Object.assign(raiz.PLANOS_A3 || {}, API);
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
