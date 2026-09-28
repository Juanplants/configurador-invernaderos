# Configurador de Invernaderos — v0.3 estructural

Herramienta local de diseño, visualización y presupuesto **estructural** de invernaderos.
Pensada para agrónomos y comerciales que venden invernaderos de fábrica china (o equivalentes).

## Cómo ejecutar

1. Abre la carpeta del proyecto en el Explorador de Windows.
2. Doble clic en `index.html`.
3. Se abrirá en tu navegador por defecto (Chrome / Edge / Firefox).

**No requiere instalación, ni Node, ni Python, ni nada.** Es HTML + JavaScript puro.

## Qué hace (v0.3)

- Selección de modelo base desde un catálogo (multitúnel, Venlo, parral).
- Dimensionado por número de naves y número de tramos entre pilares.
- Cálculo automático de superficie, volumen, nº de pilares y nº de cerchas.
- Opciones estructurales: recubrimiento, ventilación, servicios.
- Cálculo de presupuesto base + IVA.
- Cuatro vistas SVG con cajetín, escala, datos de cliente y flecha del norte:
  - Planta
  - Alzado frontal
  - Alzado lateral
  - Sección transversal con detalle de cercha
- Generación de propuesta comercial imprimible a PDF (Ctrl+P → Guardar como PDF).

## Alcance — qué se quitó respecto a v0.2

Para volver a tener un MVP manejable, se han retirado temporalmente:

- Cultivos y sistemas de producción (NFT, sacos, Dutch buckets, mesas, etc.)
- Equipamiento climático: HVAC, fog, recirculadores, pantallas, control de clima.
- Iluminación, riego/fertirrigación, calefacción, CO₂, sensores.
- ROI, facturación estimada, consumos energéticos.
- Overlays de luces / eléctrico / riego en el plano.

Estos módulos se reincorporarán cuando la base estructural esté validada.

## Roadmap inmediato

- [ ] Selector de **zona climática de España** (viento + nieve por CTE / UNE 76209) que filtre los modelos compatibles.
- [ ] Sustituir precios placeholder por datos reales de fábrica.
- [ ] Completar `specs` de los modelos secundarios (multitúnel 8 m, Venlo, parral).
- [ ] Validación de configuraciones excesivas (>5 hectáreas).
- [ ] Reincorporar módulo de equipamiento climático.

## Estructura

```
configurador-invernaderos/
├── index.html           # interfaz principal
├── styles.css           # estilos
├── js/
│   ├── modelos.js       # catálogo de modelos base
│   ├── opciones.js      # opciones estructurales (cerramiento, ventilación, servicios)
│   ├── calculos.js      # cálculos de geometría y precio
│   ├── planos.js        # generación de vistas SVG
│   ├── propuesta.js     # propuesta comercial imprimible a PDF
│   └── app.js           # orquestador (estado + render + eventos)
└── docs/
    ├── proveedores.md           # lista de fábricas candidatas
    └── acuerdo_entrega_cliente.md  # plantilla de contrato de venta
```

## Migración a web pública (futuro)

El mismo código funciona en un servidor estático sin cambios:
- Subir la carpeta a Vercel, Netlify, GitHub Pages o Cloudflare Pages.
- No hace falta backend hasta que se quiera guardar proyectos en la nube.

## Importante

⚠️ Los precios y modelos del catálogo actual son **placeholder** para validar la interfaz.
Antes de usarlo comercialmente hay que sustituirlos por los datos reales recibidos de las fábricas
contactadas en `docs/proveedores.md`.
