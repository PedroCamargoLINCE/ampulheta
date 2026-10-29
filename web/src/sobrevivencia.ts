// Matemática da curva de sobrevivência publicada no contrato (ADR-007).
// Funções puras, sem DOM: S(t) vem amostrada na grade mensal e é interpolada
// linearmente entre os pontos.

export type Grade = readonly number[];
export type Serie = readonly number[];

export type Probabilidade =
  | { tipo: 'ok'; valor: number }
  | { tipo: 'sobrevivencia-zero' }
  | { tipo: 'fora-do-horizonte'; horizonte: number };

export interface Intervalo {
  inferior: number;
  superior: number;
}

/** Quantil 0,975 da normal padrão: IC de 95%. */
const Z_95 = 1.959963984540054;

/** Último mês coberto pela grade. */
export function horizonte(grade: Grade): number {
  const ultimo = grade[grade.length - 1];
  if (ultimo === undefined) throw new RangeError('grade vazia');
  return ultimo;
}

function conferir(grade: Grade, serie: Serie): void {
  if (grade.length < 2) throw new RangeError('grade precisa de pelo menos 2 pontos');
  if (grade.length !== serie.length) throw new RangeError('grade e série com tamanhos diferentes');
}

/** S(t) interpolada linearmente. `null` se t está fora da grade. */
export function interpolar(grade: Grade, serie: Serie, t: number): number | null {
  conferir(grade, serie);
  if (!Number.isFinite(t) || t < grade[0]! || t > horizonte(grade)) return null;
  // Busca binária pelo maior i com grade[i] <= t.
  let lo = 0;
  let hi = grade.length - 1;
  while (hi - lo > 1) {
    const meio = (lo + hi) >> 1;
    if (grade[meio]! <= t) lo = meio;
    else hi = meio;
  }
  const t0 = grade[lo]!;
  const t1 = grade[hi]!;
  const s0 = serie[lo]!;
  const s1 = serie[hi]!;
  if (t <= t0) return s0;
  if (t >= t1) return s1;
  return s0 + ((t - t0) / (t1 - t0)) * (s1 - s0);
}

/**
 * P(sentença nos próximos h meses | tramita há t meses) = 1 − S(t+h)/S(t).
 * Não devolve número quando S(t) = 0 ou quando t+h passa do horizonte da grade.
 */
export function probabilidadeSentenca(grade: Grade, serie: Serie, t: number, h: number): Probabilidade {
  if (!(t >= 0) || !(h > 0)) throw new RangeError('t deve ser >= 0 e h > 0');
  const fim = horizonte(grade);
  if (t + h > fim) return { tipo: 'fora-do-horizonte', horizonte: fim };
  const st = interpolar(grade, serie, t)!;
  if (st <= 0) return { tipo: 'sobrevivencia-zero' };
  const sth = interpolar(grade, serie, t + h)!;
  const valor = 1 - sth / st;
  return { tipo: 'ok', valor: Math.min(1, Math.max(0, valor)) };
}

/**
 * IC 95% de P(sentença nos próximos h meses | tramita há t meses), na escala log(−log)
 * como os `ic_*` do contrato. Para R = S(t+h)/S(t), a soma de Greenwood dá
 * Var(log R) = σ²(t+h) − σ²(t), com σ² vindo de `greenwood_acumulado` (contrato 1.1.0)
 * interpolada como S. Os limites de R são R^exp(±z·√Var/|log R|); os de P = 1 − R saem
 * trocados. `null` quando a probabilidade não tem número ou o intervalo não se define:
 * R = 1 (nenhuma sentença no trecho), R = 0 (todos sentenciados) ou variância nula.
 */
export function intervaloSentenca(
  grade: Grade,
  serie: Serie,
  greenwood: Serie,
  t: number,
  h: number,
): Intervalo | null {
  const p = probabilidadeSentenca(grade, serie, t, h);
  if (p.tipo !== 'ok') return null;
  conferir(grade, greenwood);
  const r = 1 - p.valor;
  if (r <= 0 || r >= 1) return null;
  const variancia = interpolar(grade, greenwood, t + h)! - interpolar(grade, greenwood, t)!;
  if (!(variancia > 0)) return null;
  const a = (Z_95 * Math.sqrt(variancia)) / -Math.log(r);
  const rInferior = Math.pow(r, Math.exp(a));
  const rSuperior = Math.pow(r, Math.exp(-a));
  return { inferior: 1 - rSuperior, superior: 1 - rInferior };
}

/**
 * Primeiro instante >= aPartirDe em que S cai a `nivel` ou abaixo, interpolando
 * dentro do intervalo da grade onde o cruzamento acontece. `null` se não cai na janela.
 */
export function tempoAteNivel(grade: Grade, serie: Serie, nivel: number, aPartirDe = 0): number | null {
  conferir(grade, serie);
  const inicio = interpolar(grade, serie, aPartirDe);
  if (inicio === null) return null;
  if (inicio <= nivel) return aPartirDe;
  let tAnt = aPartirDe;
  let sAnt = inicio;
  for (let i = 0; i < grade.length; i++) {
    const ti = grade[i]!;
    if (ti <= aPartirDe) continue;
    const si = serie[i]!;
    if (si <= nivel) {
      return tAnt + ((sAnt - nivel) / (sAnt - si)) * (ti - tAnt);
    }
    tAnt = ti;
    sAnt = si;
  }
  return null;
}

/** Quantil p da duração: tempo em que (100·p)% dos processos já tiveram sentença. */
export function quantil(grade: Grade, serie: Serie, p: number): number | null {
  if (!(p > 0 && p < 1)) throw new RangeError('p deve estar em (0, 1)');
  return tempoAteNivel(grade, serie, 1 - p);
}

/**
 * Quantil condicional: quantos meses *a mais*, a partir de t, até que (100·p)% dos
 * processos que chegaram a t sem sentença tenham sido sentenciados.
 */
export function quantilCondicional(grade: Grade, serie: Serie, t: number, p: number): number | null {
  if (!(p > 0 && p < 1)) throw new RangeError('p deve estar em (0, 1)');
  const st = interpolar(grade, serie, t);
  if (st === null || st <= 0) return null;
  const alcancado = tempoAteNivel(grade, serie, (1 - p) * st, t);
  return alcancado === null ? null : alcancado - t;
}

/**
 * Curva S(t+u)/S(t) para u >= 0, amostrada em u = 0 e nos pontos da grade depois de t.
 * `null` se S(t) = 0 ou t fora da grade.
 */
export function curvaCondicional(
  grade: Grade,
  serie: Serie,
  t: number,
): { meses: number[]; valores: number[] } | null {
  const st = interpolar(grade, serie, t);
  if (st === null || st <= 0) return null;
  const meses = [0];
  const valores = [1];
  for (let i = 0; i < grade.length; i++) {
    const ti = grade[i]!;
    if (ti <= t) continue;
    meses.push(ti - t);
    valores.push(Math.min(1, serie[i]! / st));
  }
  return { meses, valores };
}
