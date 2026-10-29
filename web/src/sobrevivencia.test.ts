import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  curvaCondicional,
  interpolar,
  probabilidadeSentenca,
  quantil,
  quantilCondicional,
  tempoAteNivel,
} from './sobrevivencia';
import type { Contrato } from './dados';

// S cai 0,1 por mês até zerar no mês 10.
const grade = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const linear = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];
// Platô: nada acontece entre os meses 2 e 5.
const plato = [1, 0.8, 0.6, 0.6, 0.6, 0.6, 0.3, 0.3, 0.3, 0.3, 0.3];

describe('interpolar', () => {
  it('devolve o valor exato nos pontos da grade', () => {
    expect(interpolar(grade, linear, 0)).toBe(1);
    expect(interpolar(grade, linear, 4)).toBeCloseTo(0.6);
    expect(interpolar(grade, linear, 10)).toBe(0);
  });

  it('interpola linearmente entre pontos', () => {
    expect(interpolar(grade, linear, 2.5)).toBeCloseTo(0.75);
    expect(interpolar(grade, plato, 5.5)).toBeCloseTo(0.45);
  });

  it('funciona com grade de passo irregular', () => {
    expect(interpolar([0, 6, 12], [1, 0.4, 0.1], 9)).toBeCloseTo(0.25);
  });

  it('devolve null fora da grade', () => {
    expect(interpolar(grade, linear, -0.1)).toBeNull();
    expect(interpolar(grade, linear, 10.1)).toBeNull();
    expect(interpolar(grade, linear, Number.NaN)).toBeNull();
  });

  it('rejeita grade e série de tamanhos diferentes', () => {
    expect(() => interpolar(grade, [1, 0.5], 0)).toThrow(RangeError);
  });
});

describe('probabilidadeSentenca', () => {
  it('calcula 1 − S(t+h)/S(t)', () => {
    // S(2) = 0,8; S(5) = 0,5 → 1 − 0,5/0,8 = 0,375
    const r = probabilidadeSentenca(grade, linear, 2, 3);
    expect(r.tipo).toBe('ok');
    if (r.tipo === 'ok') expect(r.valor).toBeCloseTo(0.375);
  });

  it('em t = 0 é a probabilidade incondicional', () => {
    const r = probabilidadeSentenca(grade, linear, 0, 4);
    if (r.tipo !== 'ok') throw new Error(r.tipo);
    expect(r.valor).toBeCloseTo(0.4);
  });

  it('usa interpolação em t e t+h fracionários', () => {
    // S(1,5) = 0,85; S(4,5) = 0,55 → 1 − 0,55/0,85
    const r = probabilidadeSentenca(grade, linear, 1.5, 3);
    if (r.tipo !== 'ok') throw new Error(r.tipo);
    expect(r.valor).toBeCloseTo(1 - 0.55 / 0.85);
  });

  it('dá zero num platô', () => {
    const r = probabilidadeSentenca(grade, plato, 2, 3);
    if (r.tipo !== 'ok') throw new Error(r.tipo);
    expect(r.valor).toBeCloseTo(0);
  });

  it('não devolve número quando S(t) = 0', () => {
    expect(probabilidadeSentenca([0, 1, 2, 3], [1, 0.5, 0, 0], 2, 1)).toEqual({ tipo: 'sobrevivencia-zero' });
  });

  it('não devolve número quando t+h passa do horizonte', () => {
    expect(probabilidadeSentenca(grade, linear, 8, 3)).toEqual({ tipo: 'fora-do-horizonte', horizonte: 10 });
  });

  it('aceita t+h exatamente no horizonte', () => {
    const r = probabilidadeSentenca(grade, linear, 7, 3);
    if (r.tipo !== 'ok') throw new Error(r.tipo);
    expect(r.valor).toBeCloseTo(1);
  });

  it('rejeita t negativo e h não positivo', () => {
    expect(() => probabilidadeSentenca(grade, linear, -1, 3)).toThrow(RangeError);
    expect(() => probabilidadeSentenca(grade, linear, 1, 0)).toThrow(RangeError);
  });
});

describe('quantil e tempoAteNivel', () => {
  it('acha o cruzamento interpolado', () => {
    expect(quantil(grade, linear, 0.5)).toBeCloseTo(5);
    expect(quantil(grade, linear, 0.25)).toBeCloseTo(2.5);
    expect(quantil([0, 6, 12], [1, 0.4, 0.1], 0.5)).toBeCloseTo(5);
  });

  it('pega o primeiro cruzamento, não o fim do platô', () => {
    // S = 0,6 a partir do mês 2: p40 é o mês 2.
    expect(quantil(grade, plato, 0.4)).toBeCloseTo(2);
  });

  it('devolve null se o nível não é atingido na janela', () => {
    expect(quantil(grade, plato, 0.9)).toBeNull();
  });

  it('respeita o ponto de partida', () => {
    expect(tempoAteNivel(grade, linear, 0.45, 5.2)).toBeCloseTo(5.5);
    expect(tempoAteNivel(grade, linear, 0.9, 3)).toBe(3);
  });

  it('rejeita p fora de (0, 1)', () => {
    expect(() => quantil(grade, linear, 0)).toThrow(RangeError);
    expect(() => quantil(grade, linear, 1)).toThrow(RangeError);
  });
});

describe('quantilCondicional e curvaCondicional', () => {
  it('mede meses a mais a partir de t', () => {
    // Em t = 2, S = 0,8; metade disso é 0,4, atingido no mês 6 → 4 meses a mais.
    expect(quantilCondicional(grade, linear, 2, 0.5)).toBeCloseTo(4);
  });

  it('é consistente com probabilidadeSentenca', () => {
    const u = quantilCondicional(grade, linear, 1.5, 0.5)!;
    const r = probabilidadeSentenca(grade, linear, 1.5, u);
    if (r.tipo !== 'ok') throw new Error(r.tipo);
    expect(r.valor).toBeCloseTo(0.5);
  });

  it('devolve null quando S(t) = 0', () => {
    expect(quantilCondicional(grade, linear, 10, 0.5)).toBeNull();
    expect(curvaCondicional(grade, linear, 10)).toBeNull();
  });

  it('a curva condicional começa em 1 e usa a grade depois de t', () => {
    const c = curvaCondicional(grade, linear, 7.5)!;
    expect(c.meses).toEqual([0, 0.5, 1.5, 2.5]);
    expect(c.valores[0]).toBe(1);
    expect(c.valores[1]).toBeCloseTo(0.2 / 0.25);
    expect(c.valores[3]).toBe(0);
  });
});

describe('fixture do contrato', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('../../contracts/fixtures/curvas.exemplo.json', import.meta.url), 'utf8'),
  ) as Contrato;

  it('os quantis interpolados na grade batem com os publicados (±1 mês)', () => {
    for (const c of fixture.curvas) {
      for (const [chave, p] of [['p50', 0.5], ['p80', 0.8], ['p90', 0.9]] as const) {
        const publicado = c.quantis_meses[chave];
        const calculado = quantil(fixture.grade_meses, c.sobrevivencia, p);
        if (publicado === null) expect(calculado).toBeNull();
        else expect(Math.abs(calculado! - publicado)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('probabilidades ficam em [0, 1] para toda curva, t e h', () => {
    for (const c of fixture.curvas) {
      for (let t = 0; t <= 108; t += 6) {
        for (const h of [3, 6, 12]) {
          const r = probabilidadeSentenca(fixture.grade_meses, c.sobrevivencia, t, h);
          if (r.tipo === 'ok') {
            expect(r.valor).toBeGreaterThanOrEqual(0);
            expect(r.valor).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
