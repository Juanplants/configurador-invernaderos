// Opciones estructurales y de cerramiento.
// Solo se incluyen elementos que forman parte de la estructura
// y la envolvente. Equipamiento (HVAC, mesas, riego, control)
// se reincorporará en una fase posterior.
// Los precios son placeholder hasta recibir fichas reales de fábrica.

const OPCIONES = [
  {
    categoria: 'Recubrimiento y cerramiento',
    items: [
      { id: 'rec-doble-camara',   nombre: 'Doble cámara con inflado',        precio_m2: 5 },
      { id: 'rec-panel-sandwich', nombre: 'Panel sándwich 40 mm perímetro',  precio_m2: 35 },
      { id: 'rec-malla-antiplaga',nombre: 'Malla antiplagas 20×10',          precio_m2: 0.4 }
    ]
  },
  {
    categoria: 'Ventilación',
    items: [
      { id: 'vent-cenital-motor',  nombre: 'Ventilación cenital mariposa motorizada', precio_m2: 12 },
      { id: 'vent-lateral-enroll', nombre: 'Ventilación lateral enrollable',          precio_m2: 5 },
      { id: 'puertas-corredera',   nombre: 'Puertas correderas aluminio 1,6 m',       precio_m2: 0.8 }
    ]
  },
  {
    categoria: 'Servicios',
    items: [
      { id: 'serv-supervision', nombre: 'Supervisión de montaje',  precio_m2: 3 },
      { id: 'serv-montaje',     nombre: 'Montaje llave en mano',   precio_m2: 30 },
      { id: 'serv-transporte',  nombre: 'Transporte internacional',precio_m2: 1.2 }
    ]
  }
];
