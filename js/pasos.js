// ============================================================
// Flujo de 6 pasos (apartado 2 de la especificación)
// ============================================================
// Proyecto → Emplazamiento → Geometría → Envolvente → Revisión → Salidas.
// Se ve un paso a la vez; «Siguiente» avanza y marca el paso como visitado, y
// desde la barra se puede saltar a cualquier paso ya visitado. Solo lógica:
// el pintado está en js/app.js.
//
//   let p = PASOS.inicial();            // { actual: 'proyecto', visitados: ['proyecto'] }
//   p = PASOS.siguiente(p);             // → emplazamiento (visitado)
//   p = PASOS.ir(p, 'proyecto');        // solo si ya se visitó; si no, no cambia
//   p = PASOS.todos(p);                 // al abrir un proyecto: todos visitados

(function (raiz) {
  const LISTA = ['proyecto', 'emplazamiento', 'geometria', 'envolvente', 'revision', 'salidas'];
  const NOMBRES = {
    proyecto: 'Proyecto', emplazamiento: 'Emplazamiento', geometria: 'Geometría',
    envolvente: 'Envolvente', revision: 'Revisión', salidas: 'Salidas'
  };

  const inicial = () => ({ actual: LISTA[0], visitados: [LISTA[0]] });
  const indice = (p) => LISTA.indexOf(p.actual);
  const visitado = (p, paso) => p.visitados.includes(paso);

  function ir(p, paso) {
    if (!LISTA.includes(paso) || !visitado(p, paso)) return p;
    return { actual: paso, visitados: p.visitados.slice() };
  }
  function siguiente(p) {
    const i = indice(p);
    if (i >= LISTA.length - 1) return p;
    const paso = LISTA[i + 1];
    return { actual: paso, visitados: visitado(p, paso) ? p.visitados.slice() : p.visitados.concat(paso) };
  }
  function anterior(p) {
    const i = indice(p);
    return i <= 0 ? p : { actual: LISTA[i - 1], visitados: p.visitados.slice() };
  }
  const todos = (p) => ({ actual: p.actual, visitados: LISTA.slice() });

  const API = { LISTA, NOMBRES, inicial, ir, siguiente, anterior, todos, visitado, indice };
  raiz.PASOS = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
