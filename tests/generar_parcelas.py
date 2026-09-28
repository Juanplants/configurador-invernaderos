"""Crea las parcelas de ejemplo de las pruebas (inventadas, no son de ningún cliente):

  tests/datos/parcela_irregular.gml  — formato INSPIRE del Catastro, ETRS89 UTM 30N (EPSG:25830)
  tests/datos/parcela_irregular.kml  — el mismo polígono en longitud/latitud (como el KML de la Sede)

La conversión a longitud/latitud la hace pyproj, independiente del código de la
app: así la prueba que compara GML y KML contrasta dos caminos distintos.
Uso: python3 tests/generar_parcelas.py   (necesita pyproj)
"""
from pathlib import Path
from pyproj import Transformer

RAIZ = Path(__file__).resolve().parent.parent
DIR = RAIZ / "tests" / "datos"

# Polígono irregular y cóncavo, ~3,6 ha, alrededor de un punto inventado de UTM 30N
E0, N0 = 550000.0, 4075000.0
VERTICES = [(0, 0), (212, -14), (236, 96), (158, 118), (170, 176), (62, 205), (-18, 148), (-6, 64)]
REFCAT = "00000X00000000"  # referencia inventada

utm = [(E0 + x, N0 + y) for x, y in VERTICES]
cerrado = utm + [utm[0]]
area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(cerrado, cerrado[1:]))) / 2

pos = " ".join(f"{e:.2f} {n:.2f}" for e, n in cerrado)
gml = f"""<?xml version="1.0" encoding="utf-8"?>
<!-- Parcela de EJEMPLO inventada para las pruebas del configurador. No corresponde a ningún inmueble real. -->
<FeatureCollection xmlns="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  numberMatched="1" numberReturned="1">
  <member>
    <cp:CadastralParcel gml:id="ES.SDGC.CP.{REFCAT}">
      <cp:areaValue uom="m2">{area:.0f}</cp:areaValue>
      <cp:geometry>
        <gml:MultiSurface gml:id="MultiSurface_ES.SDGC.CP.{REFCAT}" srsName="http://www.opengis.net/def/crs/EPSG/0/25830">
          <gml:surfaceMember>
            <gml:Surface gml:id="Surface_ES.SDGC.CP.{REFCAT}.1" srsName="http://www.opengis.net/def/crs/EPSG/0/25830">
              <gml:patches>
                <gml:PolygonPatch>
                  <gml:exterior>
                    <gml:LinearRing>
                      <gml:posList srsDimension="2" count="{len(cerrado)}">{pos}</gml:posList>
                    </gml:LinearRing>
                  </gml:exterior>
                </gml:PolygonPatch>
              </gml:patches>
            </gml:Surface>
          </gml:surfaceMember>
        </gml:MultiSurface>
      </cp:geometry>
      <cp:inspireId><Identifier><localId>{REFCAT}</localId><namespace>ES.SDGC.CP</namespace></Identifier></cp:inspireId>
      <cp:label>99</cp:label>
      <cp:nationalCadastralReference>{REFCAT}</cp:nationalCadastralReference>
    </cp:CadastralParcel>
  </member>
</FeatureCollection>
"""

geo = Transformer.from_crs("EPSG:25830", "EPSG:4258", always_xy=True)
coords = " ".join("{:.9f},{:.9f},0".format(*geo.transform(e, n)) for e, n in cerrado)
kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Parcela de ejemplo (inventada)</name>
    <Placemark>
      <name>{REFCAT}</name>
      <description>Parcela de EJEMPLO inventada para las pruebas. No corresponde a ningún inmueble real.</description>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
"""

DIR.mkdir(exist_ok=True)
(DIR / "parcela_irregular.gml").write_text(gml, encoding="utf-8")
(DIR / "parcela_irregular.kml").write_text(kml, encoding="utf-8")
print(f"parcela_irregular.gml / .kml: {len(VERTICES)} vértices, {area:.0f} m² (plano UTM)")
