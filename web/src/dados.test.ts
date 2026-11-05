import { describe, expect, it } from 'vitest';
import { buscarCurva, nomeMarco, origensPara, type Contrato, type Curva } from './dados';

const curva = (extra: Partial<Curva>): Curva => ({
  vara: null,
  classe: null,
  metodo: 'kaplan-meier',
  n: 100,
  eventos: 50,
  censurados: 50,
  sobrevivencia: [1, 0.5],
  ic_inferior: [1, 0.4],
  ic_superior: [1, 0.6],
  quantis_meses: { p50: 1, p80: null, p90: null },
  ...extra,
});

const doc = {
  grade_meses: [0, 1],
  marcos: [
    { codigo: 'ajuizamento', nome: 'Ajuizamento', codigos_tpu: [] },
    { codigo: 'sentenca', nome: 'Sentença', codigos_tpu: [193] },
    { codigo: 'audiencia', nome: 'Audiência', codigos_tpu: [970] },
  ],
  curvas: [
    curva({ origem: 'audiencia', destino: 'sentenca', n: 30 }),
    curva({ n: 200 }),
    curva({ vara: '1', n: 80 }),
  ],
} as unknown as Contrato;

describe('buscarCurva', () => {
  it('sem origem, devolve ajuizamento → sentença mesmo se outra transição vier antes no arquivo', () => {
    expect(buscarCurva(doc, null, null)?.n).toBe(200);
  });

  it('com origem, devolve a curva daquela transição', () => {
    expect(buscarCurva(doc, null, null, 'audiencia')?.n).toBe(30);
  });

  it('não acha recorte que só existe em outra transição', () => {
    expect(buscarCurva(doc, '1', null, 'audiencia')).toBeUndefined();
  });
});

describe('origensPara', () => {
  it('lista as origens publicadas na ordem dos marcos', () => {
    expect(origensPara(doc)).toEqual(['ajuizamento', 'audiencia']);
  });

  it('sem marcos nem origem (contrato antigo), só ajuizamento', () => {
    const antigo = { ...doc, marcos: undefined, curvas: [curva({})] } as unknown as Contrato;
    expect(origensPara(antigo)).toEqual(['ajuizamento']);
    expect(nomeMarco(antigo, 'ajuizamento')).toBe('Ajuizamento');
  });
});
