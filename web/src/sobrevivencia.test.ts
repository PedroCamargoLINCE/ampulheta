import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  curvaCondicional,
  intervaloSentenca,
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

describe('intervaloSentenca', () => {
  const g3 = [0, 1, 2];
  const s3 = [1, 0.8, 0.4];
  const gw3 = [0, 0.01, 0.06];

  it('usa Var(log R) = σ²(t+h) − σ²(t) na escala log(−log)', () => {
    // R = 0,4/0,8 = 0,5; Var = 0,05 → P = 0,5 com IC [0,3081; 0,7287]
    const ic = intervaloSentenca(g3, s3, gw3, 1, 1)!;
    expect(ic.inferior).toBeCloseTo(0.3081075, 6);
    expect(ic.superior).toBeCloseTo(0.7286722, 6);
  });

  it('em t = 0 é o complemento do IC log(−log) de S(h)', () => {
    const ic = intervaloSentenca(g3, s3, gw3, 0, 2)!;
    const z = 1.959963984540054;
    const a = (z * Math.sqrt(0.06)) / -Math.log(0.4);
    expect(ic.inferior).toBeCloseTo(1 - Math.pow(0.4, Math.exp(-a)), 10);
    expect(ic.superior).toBeCloseTo(1 - Math.pow(0.4, Math.exp(a)), 10);
  });

  it('interpola σ² como S em t fracionário', () => {
    // S(0,5) = 0,9; S(1,5) = 0,6; σ² = 0,005 e 0,035
    const ic = intervaloSentenca(g3, s3, gw3, 0.5, 1)!;
    expect(ic.inferior).toBeCloseTo(0.160984, 5);
    expect(ic.superior).toBeCloseTo(0.6080523, 5);
  });

  it('bate com o IC do Kaplan-Meier recomeçado em t', () => {
    // Amostra pequena com censura e empates; KM e Greenwood calculados à mão.
    const tempos = [1, 2, 2, 3, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 10, 10];
    const eventos = [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0];
    const g = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const km = (ts: number[], es: number[]) => {
      const s: number[] = [];
      const v: number[] = [];
      for (const ponto of g) {
        let sAcum = 1;
        let vAcum = 0;
        for (const ti of [...new Set(ts)].sort((x, y) => x - y)) {
          if (ti > ponto) break;
          const n = ts.filter((x) => x >= ti).length;
          const d = ts.filter((x, i) => x === ti && es[i] === 1).length;
          if (d === 0) continue;
          sAcum *= 1 - d / n;
          if (n > d) vAcum += d / (n * (n - d));
        }
        s.push(sAcum);
        v.push(vAcum);
      }
      return { s, v };
    };
    const total = km(tempos, eventos);
    for (const [t, h] of [[2, 3], [3, 6], [1, 6]] as const) {
      const fica = tempos.map((x, i) => [x, eventos[i]!] as const).filter(([x]) => x > t);
      const recomecado = km(
        fica.map(([x]) => x - t),
        fica.map(([, e]) => e),
      );
      const r = recomecado.s[h]!;
      const a = (1.959963984540054 * Math.sqrt(recomecado.v[h]!)) / -Math.log(r);
      const ic = intervaloSentenca(g, total.s, total.v, t, h)!;
      expect(ic.inferior).toBeCloseTo(1 - Math.pow(r, Math.exp(-a)), 10);
      expect(ic.superior).toBeCloseTo(1 - Math.pow(r, Math.exp(a)), 10);
    }
  });

  it('devolve null quando a probabilidade não tem número', () => {
    expect(intervaloSentenca(g3, s3, gw3, 1, 2)).toBeNull(); // passa do horizonte
    expect(intervaloSentenca([0, 1, 2], [1, 0, 0], [0, 0.1, 0.1], 1, 1)).toBeNull(); // S(t) = 0
  });

  it('devolve null quando a transformação não se define', () => {
    expect(intervaloSentenca(g3, [1, 1, 0.5], [0, 0, 0.05], 0, 1)).toBeNull(); // R = 1
    expect(intervaloSentenca(g3, [1, 0.5, 0], [0, 0.05, 0.05], 1, 1)).toBeNull(); // R = 0
    expect(intervaloSentenca(g3, s3, [0, 0.01, 0.01], 1, 1)).toBeNull(); // variância nula
  });

  it('rejeita greenwood de tamanho diferente da grade', () => {
    expect(() => intervaloSentenca(g3, s3, [0, 0.01], 1, 1)).toThrow(RangeError);
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

  it('o IC envolve a probabilidade e fica em [0, 1] para toda curva, t e h', () => {
    let calculados = 0;
    for (const c of fixture.curvas) {
      expect(c.greenwood_acumulado).toBeDefined();
      for (let t = 0; t <= 108; t += 6) {
        for (const h of [3, 6, 12]) {
          const r = probabilidadeSentenca(fixture.grade_meses, c.sobrevivencia, t, h);
          const ic = intervaloSentenca(fixture.grade_meses, c.sobrevivencia, c.greenwood_acumulado!, t, h);
          if (r.tipo !== 'ok' || ic === null) continue;
          calculados++;
          expect(ic.inferior).toBeGreaterThanOrEqual(0);
          expect(ic.inferior).toBeLessThanOrEqual(r.valor + 1e-12);
          expect(ic.superior).toBeGreaterThanOrEqual(r.valor - 1e-12);
          expect(ic.superior).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(calculados).toBeGreaterThan(100);
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
