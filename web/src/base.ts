// Até onde cada curva tem base para estimar (contrato 1.2.0, campo `em_risco`).
// O README do contrato e docs/HANDOFF.md pedem que o site corte a curva e recuse número
// onde menos de MIN_EM_RISCO processos seguem sem sentença e em acompanhamento.
// Nada aqui refaz a matemática de sobrevivencia.ts: só decide em que trecho ela é usada.
import type { Curva } from './dados';
import type { Grade, Serie } from './sobrevivencia';

/** Limite sugerido no README do contrato, em t e em t+h. */
export const MIN_EM_RISCO = 10;

/**
 * Último mês da grade com pelo menos MIN_EM_RISCO processos em risco. Sem `em_risco`
 * (contrato anterior a 1.2.0), o fim da grade. `null` se nem o primeiro ponto tem base.
 */
export function mesComBase(grade: Grade, curva: Pick<Curva, 'em_risco'>): number | null {
  const ultimo = grade[grade.length - 1];
  if (ultimo === undefined) return null;
  const risco = curva.em_risco;
  if (!risco) return ultimo;
  const i = risco.findIndex((v) => v < MIN_EM_RISCO);
  if (i === -1) return ultimo;
  if (i === 0) return null;
  return grade[i - 1]!;
}

/**
 * Processos em risco no mês t: o valor no primeiro ponto da grade em t ou depois
 * (a série não cresce, então é o lado conservador). `null` sem `em_risco` ou fora da grade.
 */
export function emRiscoEm(grade: Grade, curva: Pick<Curva, 'em_risco'>, t: number): number | null {
  const risco = curva.em_risco;
  if (!risco) return null;
  const i = grade.findIndex((m) => m >= t);
  return i === -1 ? null : risco[i]!;
}

/** Grade e série só até o mês `ate` (inclusive). */
export function ate(grade: Grade, serie: Serie, mes: number): { grade: number[]; serie: number[] } {
  let n = 0;
  while (n < grade.length && grade[n]! <= mes) n++;
  return { grade: grade.slice(0, n), serie: serie.slice(0, n) };
}
