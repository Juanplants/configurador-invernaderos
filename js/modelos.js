// Catálogo de modelos base.
// Datos basados en especificaciones reales tipo J.Huete / fábrica de referencia.
// Ajustar precios y detalles al recibir fichas de los proveedores contactados.

const MODELOS = [
  {
    id: 'multitunel-gotico-96',
    nombre: 'Multitúnel Gótico 9,60 m',
    familia: 'multitunel',
    ancho_nave: 9.60,           // m
    separacion_pilares: 2.50,   // m (longitudinal)
    alto_canal: 5.00,           // m
    alto_cumbrera: 7.55,        // m
    precio_base_m2: 66,         // EUR/m² estructura base (placeholder)
    descripcion: 'Multitúnel gótico de 9,60 m de ancho de capilla, cercha gótica de gran pendiente, mayor volumen de aire y entrada de luz. Estándar del mercado para cultivos de alto valor.',

    // Especificaciones técnicas (copiables a la memoria del PDF)
    specs: {
      pilares: {
        seccion: '80 × 80 mm',
        espesor: '2 mm',
        proteccion: 'Galvanizado en caliente + pintura bituminosa en base 1,00 m'
      },
      canal: {
        tipo: 'Canal 5056 mm — 13 pliegues',
        desarrollo: '458 mm',
        espesor: '2,0 mm',
        galvanizado: 'Magnelis ZM-310'
      },
      cerchas: {
        forma: 'Gótica',
        cumbrera: 'Ø60 × 2 mm',
        arco: 'Ø60 × 1,5 mm',
        barra_cultivo: 'Ø32 × 1,5 mm',
        tirantes: 'Ø32 × 1,5 mm'
      },
      ventilacion: {
        tipo: 'Cenital mariposa',
        brazo: '50 × 30 × 1,5 mm (2,00 m)',
        motor: 'Ridder RPD300 / 300 Nm'
      },
      recubrimiento: {
        techo: 'Doble lámina de plástico con inflado',
        plastico: 'Celloflex 4TT 200 µ',
        transmision_luz: '90 % global / 15 % difusa',
        eficiencia_termica: '86 %'
      },
      cargas: {
        viento_medio: '96 km/h (10 min, 10 m altura)',
        viento_max_cerrado: '120 km/h',
        viento_max_abierto: '150 km/h (sin plásticos)',
        cultivo: '15 kg/m²',
        equipamiento: '15 kg/m²',
        nieve: '0 kg/m²'
      },
      normativa: [
        'UNE-EN 13031-1:2020 — Invernaderos. Cálculo y construcción. Producción comercial.',
        'UNE-EN 1991-1-3:2018 — Eurocódigo 1. Acciones de nieve.',
        'UNE 76209:2002 IN — Acciones del viento en invernaderos comerciales.',
        'UNE-EN 10025-1:2006 — Aceros S275JR / S235JR.',
        'UNE-EN 10346:2015 — Galvanizado en continuo DX51D / DX52D.',
        'UNE-EN ISO 1461:2010 — Galvanización en caliente.'
      ],
      cimentacion: {
        resistencia_terreno: '2 kg/cm²',
        angulo_frotamiento: '35°',
        compactacion: '95 % Proctor modificado (UNE 103501)'
      }
    }
  },

  {
    id: 'multitunel-gotico-8',
    nombre: 'Multitúnel Gótico 8,00 m',
    familia: 'multitunel',
    ancho_nave: 8.00,
    separacion_pilares: 2.50,
    alto_canal: 4.00,
    alto_cumbrera: 6.00,
    precio_base_m2: 55,
    descripcion: 'Versión más económica de multitúnel gótico, 8 m de ancho de capilla. Adecuado para explotaciones con menor tecnificación y cultivos hortícolas estándar.',
    specs: {
      pilares: { seccion: '80 × 80 mm', espesor: '2 mm', proteccion: 'Galvanizado en caliente' },
      canal: { tipo: 'Canal 5056 mm', desarrollo: '458 mm', espesor: '2,0 mm', galvanizado: 'Magnelis ZM-310' },
      cerchas: { forma: 'Gótica', cumbrera: 'Ø60 × 2 mm', arco: 'Ø60 × 1,5 mm', barra_cultivo: 'Ø32 × 1,5 mm', tirantes: 'Ø32 × 1,5 mm' },
      ventilacion: { tipo: 'Cenital mariposa', brazo: '50 × 30 × 1,5 mm', motor: 'Ridder RPD300' },
      recubrimiento: { techo: 'Film PE 200 µ térmico', plastico: 'Celloflex o equivalente', transmision_luz: '90 %', eficiencia_termica: '86 %' },
      cargas: { viento_medio: '96 km/h', viento_max_cerrado: '120 km/h', viento_max_abierto: '150 km/h', cultivo: '15 kg/m²', equipamiento: '15 kg/m²', nieve: '0 kg/m²' },
      normativa: ['UNE-EN 13031-1:2020', 'UNE-EN 1991-1-3:2018', 'UNE 76209:2002 IN'],
      cimentacion: { resistencia_terreno: '2 kg/cm²', angulo_frotamiento: '35°', compactacion: '95 % Proctor' }
    }
  },

  {
    id: 'venlo-8',
    nombre: 'Venlo vidrio 8,00 m',
    familia: 'venlo',
    ancho_nave: 8.00,
    separacion_pilares: 4.00,
    alto_canal: 5.00,
    alto_cumbrera: 6.00,
    precio_base_m2: 165,
    descripcion: 'Invernadero Venlo de vidrio, máxima transmisión lumínica, indicado para cultivos de muy alto valor (ornamental, I+D, cannabis medicinal).',
    specs: {
      pilares: { seccion: '100 × 100 mm', espesor: '3 mm', proteccion: 'Galvanizado en caliente' },
      canal: { tipo: 'Canal de aluminio Venlo', desarrollo: '—', espesor: '—', galvanizado: 'Aluminio anodizado' },
      cerchas: { forma: 'Venlo truss', cumbrera: '—', arco: '—', barra_cultivo: '—', tirantes: '—' },
      ventilacion: { tipo: 'Cenital alterna a ambos lados', brazo: 'Cremallera Venlo', motor: 'Ridder' },
      recubrimiento: { techo: 'Vidrio horticultural 4 mm', plastico: '—', transmision_luz: '92 %', eficiencia_termica: '—' },
      cargas: { viento_medio: '96 km/h', viento_max_cerrado: '130 km/h', viento_max_abierto: '—', cultivo: '25 kg/m²', equipamiento: '15 kg/m²', nieve: '25 kg/m²' },
      normativa: ['UNE-EN 13031-1:2020', 'UNE-EN 1991-1-3:2018', 'UNE 76209:2002 IN'],
      cimentacion: { resistencia_terreno: '2 kg/cm²', angulo_frotamiento: '35°', compactacion: '95 % Proctor' }
    }
  },

  {
    id: 'parral-almeria',
    nombre: 'Parral tipo Almería',
    familia: 'parral',
    ancho_nave: 6.00,
    separacion_pilares: 2.00,
    alto_canal: 4.00,
    alto_cumbrera: 4.50,
    precio_base_m2: 28,
    descripcion: 'Invernadero plano tipo Almería, estructura económica de postes y cables con cubierta plástica a dos aguas. Indicado para hortícola extensivo.',
    specs: {
      pilares: { seccion: 'Ø60 mm', espesor: '2 mm', proteccion: 'Galvanizado en caliente' },
      canal: { tipo: '—', desarrollo: '—', espesor: '—', galvanizado: '—' },
      cerchas: { forma: 'Plana raspa y amagado', cumbrera: '—', arco: '—', barra_cultivo: '—', tirantes: 'Cable de acero' },
      ventilacion: { tipo: 'Cenital y lateral enrollable', brazo: '—', motor: 'Manual o eléctrico' },
      recubrimiento: { techo: 'Film PE 200 µ', plastico: 'Tricapa térmico', transmision_luz: '88 %', eficiencia_termica: '70 %' },
      cargas: { viento_medio: '96 km/h', viento_max_cerrado: '110 km/h', viento_max_abierto: '—', cultivo: '5 kg/m²', equipamiento: '5 kg/m²', nieve: '0 kg/m²' },
      normativa: ['UNE-EN 13031-1:2020'],
      cimentacion: { resistencia_terreno: '1,5 kg/cm²', angulo_frotamiento: '30°', compactacion: '95 % Proctor' }
    }
  }
];
