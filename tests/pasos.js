// ============================================================
// Pruebas del flujo de 6 pasos (lógica, js/pasos.js)
// ============================================================
// Ejecutar:  node tests/pasos.js
// Orden de la especificación (apartado 2), avanzar y retroceder, saltar solo a
// pasos visitados, y abrir un proyecto deja ir a todos.
// (tests/pasos_navegador.js prueba el flujo en la app.)

const fs = require('fs');
const path = require('path');
const PASOS = require('../js/pasos.js');

let fallos = 0, ok = 0;
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; return; }
  fallos++;
  console.log(`  ✗ ${nombre}${detalle ? ': ' + detalle : ''}`);
}

// El orden y los nombres son los del apartado 2 de la especificación
const espec = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ESPECIFICACION.md'), 'utf8');
const seccion = espec.slice(espec.indexOf('## 2. Flujo de uso'), espec.indexOf('## 3.'));
const enEspec = [...seccion.matchAll(/^\d\. \*\*([^*]+)\*\*/gm)].map(m => m[1]);
comprobar('6 pasos en la especificación', enEspec.length === 6, JSON.stringify(enEspec));
comprobar('mismo orden y nombres que la especificación', JSON.stringify(PASOS.LISTA.map(p => PASOS.NOMBRES[p])) === JSON.stringify(enEspec), JSON.stringify(PASOS.LISTA.map(p => PASOS.NOMBRES[p])));

let p = PASOS.inicial();
comprobar('empieza en Proyecto, solo él visitado', p.actual === 'proyecto' && JSON.stringify(p.visitados) === '["proyecto"]');
comprobar('Anterior en el primero: no se mueve', PASOS.anterior(p).actual === 'proyecto');
comprobar('no se salta a un paso sin visitar', PASOS.ir(p, 'revision').actual === 'proyecto');
comprobar('paso desconocido: no cambia', PASOS.ir(p, 'otro') === p);
p = PASOS.siguiente(p); p = PASOS.siguiente(p);
comprobar('Siguiente ×2: Geometría, visitados 3', p.actual === 'geometria' && p.visitados.length === 3);
const antes = p;
p = PASOS.ir(p, 'proyecto');
comprobar('se vuelve a un paso visitado', p.actual === 'proyecto' && p.visitados.length === 3);
comprobar('sin mutar el estado anterior', antes.actual === 'geometria');
p = PASOS.ir(p, 'geometria');
comprobar('y se vuelve adelante a otro visitado', p.actual === 'geometria');
p = PASOS.anterior(p);
comprobar('Anterior: Emplazamiento', p.actual === 'emplazamiento');
p = PASOS.siguiente(p);
comprobar('Siguiente sobre un visitado no lo duplica', p.visitados.filter(x => x === 'geometria').length === 1);
for (let i = 0; i < 10; i++) p = PASOS.siguiente(p);
comprobar('Siguiente hasta el final: Salidas y todos visitados', p.actual === 'salidas' && p.visitados.length === 6);
comprobar('Siguiente en el último: no se mueve', PASOS.siguiente(p).actual === 'salidas');
const abierto = PASOS.todos(PASOS.inicial());
comprobar('al abrir un proyecto: todos visitados, sin cambiar de paso', abierto.actual === 'proyecto' && abierto.visitados.length === 6 && PASOS.ir(abierto, 'salidas').actual === 'salidas');
comprobar('índice', PASOS.indice({ actual: 'revision' }) === 4);

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
