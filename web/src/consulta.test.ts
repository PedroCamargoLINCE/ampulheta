import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { erroNumero, formatarNumero, interpretar, normalizarNumero, type Registro, type Resposta } from './consulta';
import { mesesCompletos } from './formato';
import type { Contrato } from './dados';

const doc = JSON.parse(
  readFileSync(new URL('../../data/publicado/curvas.json', import.meta.url), 'utf8'),
) as Contrato;
const HOJE = new Date(2026, 10, 5); // 05/11/2026
const NUMERO = '10403182120188260602';

const g1 = (extra: Partial<Registro> = {}): Registro => ({
  grau: 'G1',
  classe: { codigo: '7', nome: 'Procedimento Comum Cível' },
  orgaoJulgador: { codigo: '10669', nome: '01 CIVEL DE SOROCABA' },
  dataAjuizamento: '2025-05-10',
  movimentos: [{ codigo: 26, data: '2025-05-10' }],
  ...extra,
});
const resposta = (...registros: Registro[]): Resposta => ({ numero: NUMERO, registros });

describe('número CNJ', () => {
  it('aceita com e sem máscara e formata de volta', () => {
    expect(normalizarNumero('1040318-21.2018.8.26.0602')).toBe(NUMERO);
    expect(formatarNumero(NUMERO)).toBe('1040318-21.2018.8.26.0602');
    expect(erroNumero('1040318-21.2018.8.26.0602')).toBeNull();
  });

  it('explica o que está errado', () => {
    expect(erroNumero('123')).toMatch(/20 dígitos/);
    expect(erroNumero('10403182220188260602')).toMatch(/verificadores/);
    expect(erroNumero('10403188120188130602')).toMatch(/TJSP/);
  });
});

describe('mesesCompletos', () => {
  it('conta só meses fechados até hoje', () => {
    expect(mesesCompletos('2025-05-10', HOJE)).toBe(17);
    expect(mesesCompletos('2025-05-06', HOJE)).toBe(17);
    expect(mesesCompletos('2025-05-05', HOJE)).toBe(18);
    expect(mesesCompletos('2027-01-01', HOJE)).toBeNull();
  });
});

describe('interpretar', () => {
  it('sem audiência: vara, classe e tempo desde o ajuizamento', () => {
    const p = interpretar(doc, resposta(g1()), HOJE);
    expect(p).toMatchObject({ vara: '10669', classe: '7', origem: 'ajuizamento', t: 17, avisos: [] });
    expect(p.fatos).toContain('ajuizado em 10/05/2025');
    expect(p.fatos).toMatch(/^1ª Vara Cível de Sorocaba/);
  });

  it('com audiência: fase audiência e tempo desde a primeira audiência', () => {
    const p = interpretar(
      doc,
      resposta(g1({ movimentos: [{ codigo: 26, data: '2025-05-10' }, { codigo: 970, data: '2026-02-20' }, { codigo: 12624, data: '2026-01-15' }] })),
      HOJE,
    );
    expect(p).toMatchObject({ origem: 'audiencia', t: 9 });
    expect(p.fatos).toContain('audiência em 15/01/2026');
  });

  it('com sentença: não preenche o tempo e avisa', () => {
    const p = interpretar(doc, resposta(g1({ movimentos: [{ codigo: 970, data: '2025-08-01' }, { codigo: 219, data: '2026-03-02' }] })), HOJE);
    expect(p.sentenca).toBe('2026-03-02');
    expect(p.t).toBeUndefined();
    expect(p.avisos[0]).toMatch(/já tem sentença.*02\/03\/2026/);
  });

  it('só 2º grau: não preenche e explica', () => {
    const p = interpretar(doc, resposta(g1({ grau: 'G2' })), HOJE);
    expect(p.vara).toBeUndefined();
    expect(p.fatos).toMatch(/2º grau/);
  });

  it('vara e classe fora da base: deixa para a pessoa escolher', () => {
    const p = interpretar(
      doc,
      resposta(g1({ orgaoJulgador: { codigo: '99999', nome: 'VARA X' }, classe: { codigo: '1116', nome: 'Execução Fiscal' } })),
      HOJE,
    );
    expect(p.vara).toBeUndefined();
    expect(p.classe).toBeUndefined();
    expect(p.avisos).toHaveLength(2);
    expect(p.t).toBe(17);
  });

  it('prefere o registro de 1º grau quando vêm os dois', () => {
    const p = interpretar(doc, resposta(g1({ grau: 'G2', orgaoJulgador: { codigo: '1', nome: 'CÂMARA' } }), g1()), HOJE);
    expect(p.vara).toBe('10669');
  });
});
