// Peças de interface usadas pelas duas telas.
import type { Contrato } from './dados';

/** Valor do <option> que representa `null` (todas) no contrato. */
const TODAS = '';

export function paraCodigo(valor: string): string | null {
  return valor === TODAS ? null : valor;
}

export function criarSelect(
  id: string,
  rotulo: string,
  opcoes: { valor: string | null; texto: string }[],
  inicial: string | null,
): { campo: HTMLDivElement; select: HTMLSelectElement } {
  const campo = document.createElement('div');
  campo.className = 'campo';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = rotulo;
  const select = document.createElement('select');
  select.id = id;
  for (const o of opcoes) {
    const opt = document.createElement('option');
    opt.value = o.valor ?? TODAS;
    opt.textContent = o.texto;
    select.appendChild(opt);
  }
  select.value = inicial ?? TODAS;
  campo.append(label, select);
  return { campo, select };
}

export function opcoesVara(doc: Contrato): { valor: string | null; texto: string }[] {
  return [
    { valor: null, texto: 'Todas as varas' },
    ...doc.varas.map((v) => ({
      valor: v.codigo,
      texto: v.nome.includes(v.municipio) ? v.nome : `${v.nome} (${v.municipio})`,
    })),
  ];
}

export function opcoesClasse(doc: Contrato): { valor: string | null; texto: string }[] {
  return [{ valor: null, texto: 'Todas as classes' }, ...doc.classes.map((c) => ({ valor: c.codigo, texto: c.nome }))];
}

export function html(tag: string, classe: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/** Bancada: coluna de controles à esquerda, folha impressa à direita. */
export function criarBancada(painel: HTMLElement): { controles: HTMLElement; folha: HTMLElement } {
  const bancada = html('div', 'bancada');
  const controles = html('div', 'coluna-controles');
  const folha = html('div', 'folha');
  bancada.append(controles, folha);
  painel.appendChild(bancada);
  return { controles, folha };
}

export const AVISO_PASSADO =
  'O modelo descreve o passado: mostra como processos parecidos tramitaram até a data do snapshot. ' +
  'Mudança de juiz, de sistema ou de lei pode tornar o futuro diferente. Não substitui a avaliação de um advogado.';
