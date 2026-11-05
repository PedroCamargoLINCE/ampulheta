// Consulta por número (ADR-016): o navegador chama a função mínima em `consulta/`, que
// repassa à API Pública do DataJud. Aqui ficam só a validação do número e a leitura da
// resposta em termos do contrato: vara, classe, fase e tempo. Nada é guardado.
import { DESTINO_PADRAO, ORIGEM_PADRAO, nomeMarco, nomeVara, origensPara, type Contrato } from './dados';
import { dataIso, meses, mesesCompletos } from './formato';

export interface Movimento {
  codigo: number;
  data: string;
}

export interface Registro {
  grau: string | null;
  classe: { codigo: string; nome: string } | null;
  orgaoJulgador: { codigo: string; nome: string } | null;
  dataAjuizamento: string | null;
  movimentos: Movimento[];
}

export interface Resposta {
  numero: string;
  registros: Registro[];
}

/** O que a consulta preenche na tela; `undefined` = não deu para preencher aquele campo. */
export interface Preenchimento {
  vara?: string;
  classe?: string;
  origem?: string;
  t?: number;
  /** O que veio do DataJud, em uma frase. */
  fatos: string;
  /** Motivos para a pessoa conferir ou completar à mão. */
  avisos: string[];
  /** Já há sentença de 1º grau: a estimativa não se aplica. */
  sentenca?: string;
}

/** Os 20 dígitos do número CNJ, aceitando a máscara 0000000-00.0000.0.00.0000. */
export function normalizarNumero(texto: string): string | null {
  const d = texto.replace(/[\s.\-]/g, '');
  return /^\d{20}$/.test(d) ? d : null;
}

/** Dígitos verificadores pela regra do CNJ (módulo 97). */
export function digitosConferem(d: string): boolean {
  const n = BigInt(`${d.slice(0, 7)}${d.slice(9, 13)}${d[13]}${d.slice(14, 16)}${d.slice(16)}00`);
  return 98n - (n % 97n) === BigInt(d.slice(7, 9));
}

export function doTJSP(d: string): boolean {
  return d[13] === '8' && d.slice(14, 16) === '26';
}

/** 1040318-21.2018.8.26.0602 */
export function formatarNumero(d: string): string {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/** Erro para mostrar junto do campo, ou null se o número pode ser consultado. */
export function erroNumero(texto: string): string | null {
  const d = normalizarNumero(texto);
  if (!d) return 'Informe os 20 dígitos do número, como 1040318-21.2018.8.26.0602.';
  if (!digitosConferem(d)) return 'Os dígitos verificadores não conferem. Confira o número.';
  if (!doTJSP(d)) return 'Por enquanto só há dados do TJSP (número terminando em .8.26.xxxx).';
  return null;
}

/** Primeira data em que algum dos códigos aparece, como o pipeline faz com os marcos. */
function primeiraData(movs: Movimento[], codigos: ReadonlySet<number>): string | null {
  const datas = movs.filter((m) => codigos.has(m.codigo)).map((m) => m.data).sort();
  return datas[0] ?? null;
}

/**
 * Lê a resposta da consulta nos termos do contrato. A fase é o último marco já atingido
 * (contrato 1.3.0, `marcos`), e o tempo conta da primeira vez em que ele aparece.
 */
export function interpretar(doc: Contrato, r: Resposta, hoje = new Date()): Preenchimento {
  const g1 = r.registros.find((x) => x.grau === 'G1');
  if (!g1) {
    return {
      fatos: `O DataJud só trouxe ${r.registros.length === 1 ? 'o registro' : 'registros'} de 2º grau deste processo.`,
      avisos: ['Isso costuma indicar que já houve sentença e recurso. A estimativa vale para quem ainda espera a sentença de 1º grau.'],
    };
  }
  const avisos: string[] = [];
  const p: Preenchimento = { fatos: '', avisos };

  const orgao = g1.orgaoJulgador;
  if (orgao && doc.varas.some((v) => v.codigo === orgao.codigo)) p.vara = orgao.codigo;
  else if (orgao) avisos.push(`A vara “${orgao.nome}” não está na base. Escolha “Todas as varas” para uma estimativa mais ampla.`);

  const classe = g1.classe;
  if (classe && doc.classes.some((c) => c.codigo === classe.codigo)) p.classe = classe.codigo;
  else if (classe) avisos.push(`A classe “${classe.nome}” não está na base. Escolha “Todas as classes” para uma estimativa mais ampla.`);

  const partes = [p.vara ? nomeVara(doc, p.vara) : orgao?.nome, classe?.nome, g1.dataAjuizamento && `ajuizado em ${dataIso(g1.dataAjuizamento)}`].filter(Boolean);

  const marcos = new Map((doc.marcos ?? []).map((m) => [m.codigo, new Set(m.codigos_tpu)]));
  const codSentenca = marcos.get(DESTINO_PADRAO);
  const sentenca = codSentenca ? primeiraData(g1.movimentos, codSentenca) : null;
  if (sentenca) {
    p.sentenca = sentenca;
    p.fatos = `${partes.join(', ')}.`;
    avisos.unshift(
      `Este processo já tem sentença de 1º grau registrada em ${dataIso(sentenca)}. A estimativa vale para quem ainda espera a sentença.`,
    );
    return p;
  }

  // Último marco atingido entre as origens publicadas (na ordem dos marcos).
  let origem = ORIGEM_PADRAO;
  let inicio = g1.dataAjuizamento;
  for (const o of origensPara(doc)) {
    const cods = marcos.get(o);
    const data = o === ORIGEM_PADRAO || !cods ? null : primeiraData(g1.movimentos, cods);
    if (data) {
      origem = o;
      inicio = data;
    }
  }
  p.origem = origem;
  if (origem !== ORIGEM_PADRAO && inicio) partes.push(`${nomeMarco(doc, origem).toLowerCase()} em ${dataIso(inicio)}`);
  if (inicio) {
    const t = mesesCompletos(inicio, hoje);
    if (t === null) avisos.push('A data registrada no DataJud está no futuro. Informe o tempo à mão.');
    else p.t = t;
  } else avisos.push('O DataJud não trouxe a data de ajuizamento. Informe o tempo à mão.');
  p.fatos = `${partes.join(', ')}.`;
  if (p.t !== undefined && origem !== ORIGEM_PADRAO) {
    p.fatos += ` Contamos ${meses(p.t)} desde a ${nomeMarco(doc, origem).toLowerCase()}.`;
  }
  return p;
}

export class ErroConsulta extends Error {
  constructor(
    message: string,
    readonly tentarDeNovo = false,
  ) {
    super(message);
  }
}

/** Chama a função; a API do CNJ leva de 30 s a 1 min. */
export async function consultar(url: string, numero: string, sinal: AbortSignal): Promise<Resposta> {
  let resposta: Response;
  try {
    resposta = await fetch(`${url}?numero=${encodeURIComponent(numero)}`, { signal: sinal });
  } catch (e) {
    if (sinal.aborted) throw e;
    throw new ErroConsulta('Não foi possível falar com a consulta. Verifique a conexão.', true);
  }
  const corpo = (await resposta.json().catch(() => ({}))) as Partial<Resposta> & { erro?: string; tentarDeNovo?: boolean };
  if (!resposta.ok) throw new ErroConsulta(corpo.erro ?? `A consulta falhou (HTTP ${resposta.status}).`, Boolean(corpo.tentarDeNovo));
  return corpo as Resposta;
}
