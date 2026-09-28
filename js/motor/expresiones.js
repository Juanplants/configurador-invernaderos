// ============================================================
// Evaluador seguro de expresiones del catálogo
// ============================================================
// Las columnas "Factor" y "Fórmula avanzada" del catálogo contienen
// expresiones como  naves*5  o  (4+2*ceil(tramos/5))*kg_arriostramiento.
// Este evaluador SOLO admite números, variables conocidas, + - * / ( )
// y unas pocas funciones. No ejecuta código arbitrario (sin eval).

(function (raiz) {
  const FUNCIONES = {
    ceil: Math.ceil, floor: Math.floor, round: Math.round,
    min: Math.min, max: Math.max, sqrt: Math.sqrt, abs: Math.abs
  };

  function tokenizar(texto) {
    const tokens = [];
    const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(.))/g;
    let m;
    while ((m = re.exec(texto)) !== null) {
      if (m[0].trim() === '') continue;
      if (m[1] !== undefined) tokens.push({ t: 'num', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] });
      else if ('+-*/(),'.includes(m[3])) tokens.push({ t: 'op', v: m[3] });
      else throw new Error(`Carácter no permitido "${m[3]}" en "${texto}"`);
    }
    return tokens;
  }

  function evaluar(expresion, variables) {
    if (typeof expresion === 'number') return expresion;
    if (expresion === undefined || expresion === null || String(expresion).trim() === '') {
      throw new Error('Expresión vacía');
    }
    const texto = String(expresion);
    const tk = tokenizar(texto);
    let i = 0;
    const ver = () => tk[i];
    const tomar = (v) => {
      const t = tk[i];
      if (!t || (v !== undefined && t.v !== v)) throw new Error(`Se esperaba "${v}" en "${texto}"`);
      i++; return t;
    };

    function suma() {
      let a = producto();
      while (ver() && (ver().v === '+' || ver().v === '-')) {
        const op = tomar().v; const b = producto();
        a = op === '+' ? a + b : a - b;
      }
      return a;
    }
    function producto() {
      let a = unario();
      while (ver() && (ver().v === '*' || ver().v === '/')) {
        const op = tomar().v; const b = unario();
        a = op === '*' ? a * b : a / b;
      }
      return a;
    }
    function unario() {
      if (ver() && ver().v === '-') { tomar(); return -unario(); }
      if (ver() && ver().v === '+') { tomar(); return unario(); }
      return atomo();
    }
    function atomo() {
      const t = ver();
      if (!t) throw new Error(`Expresión incompleta: "${texto}"`);
      if (t.t === 'num') { i++; return t.v; }
      if (t.v === '(') { tomar('('); const v = suma(); tomar(')'); return v; }
      if (t.t === 'id') {
        i++;
        if (ver() && ver().v === '(') {
          const f = FUNCIONES[t.v];
          if (!f) throw new Error(`Función desconocida "${t.v}"`);
          tomar('(');
          const args = [suma()];
          while (ver() && ver().v === ',') { tomar(','); args.push(suma()); }
          tomar(')');
          return f(...args);
        }
        if (!(t.v in variables)) throw new Error(`Variable desconocida "${t.v}" en "${texto}"`);
        return variables[t.v];
      }
      throw new Error(`Símbolo inesperado "${t.v}" en "${texto}"`);
    }

    const valor = suma();
    if (i < tk.length) throw new Error(`Sobra texto en "${texto}"`);
    if (!Number.isFinite(valor)) throw new Error(`Resultado no numérico en "${texto}"`);
    return valor;
  }

  const API = { evaluar };
  raiz.MOTOR = Object.assign(raiz.MOTOR || {}, { expresiones: API });
  if (typeof module !== 'undefined') module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
