import { describe, expect, it } from 'vitest';
import { ate, emRiscoEm, mesComBase, MIN_EM_RISCO } from './base';

const grade = [0, 1, 2, 3, 4, 5];

describe('mesComBase', () => {
  it('usa o fim da grade quando o contrato não traz em_risco', () => {
    expect(mesComBase(grade, {})).toBe(5);
  });

  it('para no último mês com pelo menos o mínimo em risco', () => {
    expect(mesComBase(grade, { em_risco: [100, 40, MIN_EM_RISCO, MIN_EM_RISCO - 1, 3, 0] })).toBe(2);
  });

  it('cobre a grade inteira quando nunca cai abaixo do mínimo', () => {
    expect(mesComBase(grade, { em_risco: [100, 90, 80, 70, 60, 50] })).toBe(5);
  });

  it('devolve null quando nem o primeiro ponto tem base', () => {
    expect(mesComBase(grade, { em_risco: [5, 4, 3, 2, 1, 0] })).toBeNull();
  });
});

describe('emRiscoEm', () => {
  const curva = { em_risco: [100, 80, 60, 40, 20, 0] };

  it('lê o valor no ponto da grade', () => {
    expect(emRiscoEm(grade, curva, 2)).toBe(60);
  });

  it('entre dois pontos, usa o seguinte (lado conservador)', () => {
    expect(emRiscoEm(grade, curva, 2.4)).toBe(40);
  });

  it('devolve null sem em_risco ou fora da grade', () => {
    expect(emRiscoEm(grade, {}, 2)).toBeNull();
    expect(emRiscoEm(grade, curva, 6)).toBeNull();
  });
});

describe('ate', () => {
  it('corta grade e série no mês pedido, inclusive', () => {
    expect(ate(grade, [1, 0.9, 0.8, 0.7, 0.6, 0.5], 3)).toEqual({ grade: [0, 1, 2, 3], serie: [1, 0.9, 0.8, 0.7] });
  });
});
