"""Implementación de referencia INDEPENDIENTE del motor, en Python.

Calcula los mismos casos que tests/pruebas.js a partir de la plantilla
Excel del catálogo, con código escrito por separado. Si el motor en
JavaScript y esta referencia coinciden, las reglas están bien aplicadas.
Genera tests/esperado.json.
"""
import json, math
from openpyxl import load_workbook

wb = load_workbook("datos/Catalogo_Plantilla_v0.4.xlsx", data_only=True)
def filas(h):
    ws = wb[h]; cab = [c.value for c in ws[4]]
    return [dict(zip(cab, r)) for r in ws.iter_rows(min_row=6, values_only=True) if r[0]]
MOD = {m["Id"]: m for m in filas("Modelos")}
PER = {p["Id"]: p for p in filas("Perfiles")}
CUB = {c["Id"]: c for c in filas("Cubiertas")}
EQU = {e["Id"]: e for e in filas("Equipos")}
OBRA = {z["Zona"]: z for z in filas("Obra local")}
IVA = filas("Empresa")[0]["IVA"] / 100

def caso(mid, naves, tramos, h, puertas=1, cenital="C20", sep=None, zona="Almería"):
    m = MOD[mid]; i = 0 if mid == "MT-GOT-80" else 1
    w = float(str(m["Anchos de nave admitidos"]).split(";")[0])
    s = sep or float(str(m["Separaciones entre pórticos"]).split(";")[0])
    f = m["Flecha del arco"]
    L = tramos * s; P = tramos + 1; W = naves * w; A = W * L
    arco = (w**2 + 16/3 * f**2) ** 0.5
    pil = (naves + 1) * P
    has = 2 * naves * (round(w / m["Sep. pilares hastial"]) - 1)
    lv = L - 2 * s
    hoja = m["Ancho hoja cenital"]
    lin = {"C20": 1, "C21": 2, None: 0}[cenital]
    pil_kg = [5.9, 8.5][i]; arc_kg = [1.97, 2.27][i]; can_kg = [7.85, 9.8][i]
    L_ = []
    def add(id, q, imp, kg=0): L_.append({"id": id, "cantidad": q, "importe": imp, "kg": kg})
    q = pil * h * pil_kg; add("C01", q, q * 1.40, q)
    q = P * naves * arco * arc_kg; add("C02", q, q * 1.40, q)
    q = P * naves * w * 1.8 * 1.13; add("C03", q, q * 1.40, q)
    q = naves * [5, 6][i] * L * 0.87; add("C04", q, q * 1.40, q)
    q = (naves + 1) * L * can_kg; add("C05", q, q * 1.50, q)
    q = has * h * 3.14; add("C06", q, q * 1.40, q)
    q = (4 + 2 * math.ceil(tramos / 5)) * m["Arriostramiento"]; add("C09", q, q * 1.40, q)
    acero = sum(x["importe"] for x in L_)
    add("C07", pil + has, (pil + has) * 6)
    add("C08", 0.08, 0.08 * acero)
    q = naves * arco * L * 1.1; add("C10", q, q * 0.45)
    q = (2 * L * h + 2 * (W * h + naves * 2/3 * w * f)) * 1.1; add("C11", q, q * 0.45)
    per = 2*naves*L + 2*naves*arco + 4*L + 4*W; add("C12", per, per * 0.90); add("C13", per, per * 0.15)
    if lin: add(cenital, naves * lin * lv, naves * lin * lv * 9)
    mot = naves * lin * math.ceil(lv / 90); add("C22", mot, mot * 449)
    add("C23", 2 * L, 2 * L * 3)
    ml = 2 * math.ceil(L / 90); add("C26", ml, ml * 449)
    sv = naves * lin * lv * hoja + 2 * L * 2.0; add("C24", sv * 1.1, sv * 1.1 * 0.35)
    add("C25", 1, 600); add("C30", puertas, puertas * 420)
    mat = sum(x["importe"] for x in L_)
    z = OBRA[zona]; obra = z["Movilización"] + z["Montaje"] * A + z["Hoyos y dados"] * (pil + has)
    base = mat + obra
    fm = CUB["MALLA-20x10"]["Factor paso de aire"]
    cen = naves * lin * lv * min(1.0, hoja) * fm; lat = 2 * L * 2.0 * fm
    return {"lineas": L_, "materiales": mat, "obra": obra, "base": base, "total": base * (1 + IVA),
            "pct_cenital": cen / A, "pct_total": (cen + lat) / A, "pilares": pil, "area": A}

esperado = {
  "A_una_hoja": caso("MT-GOT-80", 3, 11, 4.5),
  "B_mariposa": caso("MT-GOT-96", 6, 22, 4.5, puertas=2, cenital="C21"),
  "A_techo_cerrado": caso("MT-GOT-80", 3, 11, 4.5, cenital=None),
}
json.dump(esperado, open("tests/esperado.json", "w"), indent=1)
print({k: round(v["base"], 2) for k, v in esperado.items()})
