// Componentes de interface compartilhados pelas telas (docs/DESIGN.md, seção 8).
import type { Contrato } from './dados';
import { dataIso } from './formato';
import { MIN_EM_RISCO } from './base';

/** Valor do <option> que representa `null` (agregação “Todas”) no contrato. */
export const TODAS = 'todas';
/** Valor do <option> de instrução, quando nada foi escolhido. */
export const NADA = '';

export function paraCodigo(valor: string): string | null {
  return valor === TODAS ? null : valor;
}

export function deCodigo(codigo: string | null): string {
  return codigo ?? TODAS;
}

export function html(tag: string, classe: string, texto?: string): HTMLElement {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texto !== undefined) n.textContent = texto;
  return n;
}

export interface Campo<T extends HTMLElement> {
  campo: HTMLDivElement;
  controle: T;
  /** Mostra o erro junto do campo (texto, não só cor) ou limpa com `null`. */
  erro: (mensagem: string | null) => void;
}

/**
 * Botão "?" que mostra e esconde uma explicação curta (padrão de divulgação: funciona com
 * teclado, toque e leitor de tela, sem depender de hover).
 */
export function ajudaRecolhida(id: string, assunto: string, texto: string): { botao: HTMLButtonElement; painel: HTMLElement } {
  const painel = html('p', 'ajuda', texto);
  painel.id = id;
  painel.hidden = true;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ajuda-botao';
  b.textContent = '?';
  b.setAttribute('aria-label', `O que é ${assunto}?`);
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', id);
  b.addEventListener('click', () => {
    painel.hidden = !painel.hidden;
    b.setAttribute('aria-expanded', String(!painel.hidden));
  });
  return { botao: b, painel };
}

/** Campo com rótulo permanente, ajuda recolhida atrás de "?" e erro textual. */
function montarCampo<T extends HTMLElement>(id: string, rotulo: string, controle: T, ajuda?: string): Campo<T> {
  const campo = document.createElement('div');
  campo.className = 'campo';
  const linha = html('div', 'rotulo-linha');
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = rotulo;
  linha.appendChild(label);
  controle.id = id;
  campo.append(linha, controle);

  const descritores: string[] = [];
  if (ajuda) {
    const { botao: b, painel } = ajudaRecolhida(`${id}-ajuda`, rotulo.toLowerCase(), ajuda);
    linha.appendChild(b);
    campo.appendChild(painel);
    descritores.push(painel.id);
  }
  const msg = html('p', 'erro');
  msg.id = `${id}-erro`;
  msg.hidden = true;
  campo.appendChild(msg);
  if (descritores.length) controle.setAttribute('aria-describedby', descritores.join(' '));

  const erro = (mensagem: string | null) => {
    msg.hidden = mensagem === null;
    msg.textContent = mensagem ?? '';
    if (mensagem === null) {
      controle.removeAttribute('aria-invalid');
      if (descritores.length) controle.setAttribute('aria-describedby', descritores.join(' '));
      else controle.removeAttribute('aria-describedby');
    } else {
      controle.setAttribute('aria-invalid', 'true');
      controle.setAttribute('aria-describedby', [msg.id, ...descritores].join(' '));
    }
  };
  return { campo, controle, erro };
}

export interface Opcao {
  valor: string;
  texto: string;
}

export function criarSelect(
  id: string,
  rotulo: string,
  opcoes: Opcao[],
  inicial: string,
  ajuda?: string,
): Campo<HTMLSelectElement> {
  const select = document.createElement('select');
  for (const o of opcoes) {
    const opt = document.createElement('option');
    opt.value = o.valor;
    opt.textContent = o.texto;
    select.appendChild(opt);
  }
  select.value = inicial;
  return montarCampo(id, rotulo, select, ajuda);
}

export function criarEntrada(
  id: string,
  rotulo: string,
  atributos: Partial<Pick<HTMLInputElement, 'type' | 'inputMode' | 'min' | 'max' | 'step' | 'autocomplete'>>,
  ajuda?: string,
): Campo<HTMLInputElement> {
  const input = document.createElement('input');
  Object.assign(input, atributos);
  return montarCampo(id, rotulo, input, ajuda);
}

export function botao(texto: string, variante: 'principal' | 'secundario', tipo: 'submit' | 'button' = 'button'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = tipo;
  b.className = `botao botao-${variante}`;
  b.textContent = texto;
  return b;
}

export type TipoAviso = 'info' | 'atencao' | 'erro';
const PREFIXO: Record<TipoAviso, string> = { info: 'Observação', atencao: 'Atenção', erro: 'Não foi possível continuar' };

/** Aviso com motivo, impacto e próximo passo. O tipo aparece em texto, não só na cor. */
export function aviso(tipo: TipoAviso, texto: string, proximoPasso?: string, acao?: HTMLElement): HTMLElement {
  const caixa = html('div', `aviso aviso-${tipo}`);
  const p = document.createElement('p');
  p.append(html('strong', '', `${PREFIXO[tipo]}. `), texto);
  caixa.appendChild(p);
  if (proximoPasso) caixa.appendChild(html('p', 'aviso-passo', proximoPasso));
  if (acao) caixa.appendChild(acao);
  return caixa;
}

export type ConteudoCartao =
  | { tipo: 'ok'; valor: string; intervalo: string | null }
  | { tipo: 'sem-estimativa'; motivo: string };

/** Resumo de estimativa: horizonte, probabilidade e intervalo, ou o motivo curto de não haver número. */
export function cartaoProbabilidade(meses: number, c: ConteudoCartao): HTMLElement {
  const item = html('div', 'probabilidade');
  item.appendChild(html('dt', '', `em ${meses} meses`));
  const dd = document.createElement('dd');
  if (c.tipo === 'ok') {
    dd.appendChild(html('span', 'valor', c.valor));
    if (c.intervalo) dd.appendChild(html('span', 'ic', c.intervalo));
  } else {
    dd.append(html('span', 'valor indisponivel', 'sem estimativa'), html('span', 'ic', c.motivo));
  }
  item.appendChild(dd);
  return item;
}

/**
 * Copiar o link do resultado. Dentro de um quadro (prévia, artifact) o navegador pode
 * bloquear a área de transferência: aí o link aparece num campo, selecionado, para copiar à mão.
 */
export function copiarLink(anunciar: (texto: string) => void): HTMLElement {
  const caixa = html('div', 'copiar-link');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'link-botao';
  b.textContent = 'Copiar link';
  const campo = document.createElement('input');
  campo.type = 'text';
  campo.readOnly = true;
  campo.className = 'link-campo';
  campo.setAttribute('aria-label', 'Link deste resultado');
  campo.hidden = true;
  b.addEventListener('click', async () => {
    try {
      if (window.top !== window.self) throw new Error('em quadro');
      await navigator.clipboard.writeText(location.href);
      b.textContent = 'Link copiado';
      anunciar('Link copiado.');
      setTimeout(() => (b.textContent = 'Copiar link'), 2000);
    } catch {
      campo.value = location.href;
      campo.hidden = false;
      campo.focus();
      campo.select();
      anunciar('Copie o link do campo selecionado.');
    }
  });
  caixa.append(b, campo);
  return caixa;
}

export function opcoesVara(doc: Contrato, instrucao?: string): Opcao[] {
  return [
    ...(instrucao ? [{ valor: NADA, texto: instrucao }] : []),
    { valor: TODAS, texto: `Todas as varas (${doc.varas.length} varas da base)` },
    ...doc.varas.map((v) => ({
      valor: v.codigo,
      texto: v.nome.includes(v.municipio) ? v.nome : `${v.nome} (${v.municipio})`,
    })),
  ];
}

export function opcoesClasse(doc: Contrato, instrucao?: string): Opcao[] {
  return [
    ...(instrucao ? [{ valor: NADA, texto: instrucao }] : []),
    { valor: TODAS, texto: `Todas as classes (${doc.classes.length} classes da base)` },
    ...doc.classes.map((c) => ({ valor: c.codigo, texto: c.nome })),
  ];
}

/** Bancada: coluna de controles à esquerda, resultado à direita (uma coluna no celular). */
export function criarBancada(painel: HTMLElement): { controles: HTMLElement; folha: HTMLElement } {
  const bancada = html('div', 'bancada');
  const controles = html('div', 'coluna-controles');
  const folha = html('div', 'folha');
  bancada.append(controles, folha);
  painel.appendChild(bancada);
  fixarColuna(controles);
  return { controles, folha };
}

/**
 * A coluna de controles fica parada enquanto a folha rola. Se for mais alta que a janela,
 * o `top` negativo faz ela rolar junto até mostrar o fim e só então parar, para nenhum
 * controle ficar inalcançável.
 */
function fixarColuna(coluna: HTMLElement): void {
  const ajustar = () => {
    const margem = parseFloat(getComputedStyle(coluna).getPropertyValue('--margem-coluna')) || 0;
    const topo = Math.min(margem, window.innerHeight - coluna.offsetHeight - margem);
    coluna.style.setProperty('--topo-coluna', `${topo}px`);
  };
  new ResizeObserver(ajustar).observe(coluna);
  window.addEventListener('resize', ajustar);
}

export function grau(doc: Contrato): string {
  return doc.grau === 'G1' ? '1º grau' : '2º grau';
}

/** "9 varas de Sorocaba, TJSP, 1º grau". */
export function cobertura(doc: Contrato): string {
  const municipios = [...new Set(doc.varas.map((v) => v.municipio))];
  const lista =
    municipios.length <= 1 ? municipios.join('') : `${municipios.slice(0, -1).join(', ')} e ${municipios.at(-1)}`;
  const varas = `${doc.varas.length} ${doc.varas.length === 1 ? 'vara' : 'varas'}`;
  return `${varas}${lista ? ` de ${lista}` : ''}, ${doc.tribunal}, ${grau(doc)}`;
}

/** Limitação essencial, para ficar junto do resultado e não só no rodapé. */
export function limitacoes(doc: Contrato): string {
  return (
    `Baseado em como processos do recorte tramitaram até ${dataIso(doc.snapshot)}. ` +
    'Não prevê o resultado da decisão nem o tempo de recursos.'
  );
}

/** Metodologia expansível: termos técnicos ficam aqui, sempre explicados. */
export function comoCalculamos(doc: Contrato): HTMLDetailsElement {
  const d = document.createElement('details');
  d.className = 'metodologia';
  d.appendChild(html('summary', '', 'Como calculamos'));
  const corpo = html('div', 'metodologia-corpo');
  for (const t of paragrafosMetodologia(doc)) corpo.appendChild(html('p', '', t));
  d.appendChild(corpo);
  return d;
}

export function paragrafosMetodologia(doc: Contrato): string[] {
  return [
    `Os dados são públicos, do ${doc.fonte.nome}, com data de referência ${dataIso(doc.snapshot)}. ` +
      `Cobrem ${cobertura(doc)}.`,
    `“Sentença” aqui é o ${doc.evento.charAt(0).toLowerCase()}${doc.evento.slice(1)}: o fim do 1º grau, não do processo. ` +
      'Recursos podem estender bastante o tempo total.',
    'Muitos processos ainda não tinham sentença na data de referência. Descartá-los deixaria a estimativa otimista, ' +
      'porque só os rápidos entrariam. Por isso usamos análise de sobrevivência (estimador de Kaplan-Meier): ' +
      'cada processo sem sentença observada conta até o fim do acompanhamento. Em estatística, eles se chamam “censurados”.',
    'A curva “ainda sem sentença” é a proporção de processos do recorte que continuavam sem sentença a cada mês. ' +
      'Na tela Estimar tempo, ela recomeça a partir do tempo informado: só entram os processos que chegaram a esse tempo sem sentença.',
    'O intervalo de confiança de 95% expressa a incerteza estatística da estimativa, calculada pela variância de Greenwood ' +
      'na escala log(−log). Ele vale sob as hipóteses do método. Não é uma garantia para um processo individual nem cobre mudanças futuras.',
    `Onde menos de ${MIN_EM_RISCO} processos do recorte seguiam sem sentença e em acompanhamento, a curva é cortada e não mostramos número: ` +
      'um único processo bastaria para mudar o resultado.',
    'Diferenças entre varas podem refletir o tipo de processo que cada uma recebe e outros fatores. A curva não mede a qualidade do trabalho de uma vara, ' +
      'e a sobreposição ou não das faixas de confiança não é um teste de diferença entre curvas.',
    'A estimativa não substitui a avaliação de um advogado. Mudanças de juiz, de sistema ou de lei podem tornar o futuro diferente.',
  ];
}

/** Estado no link: `#aba?chave=valor`. */
export function lerEstado(): { aba: string; params: URLSearchParams } {
  const bruto = location.hash.replace(/^#/, '');
  const [aba = '', consulta = ''] = bruto.split('?');
  return { aba, params: new URLSearchParams(consulta) };
}

export function gravarEstado(aba: string, params: URLSearchParams | null): void {
  const consulta = params?.toString();
  const alvo = `#${aba}${consulta ? `?${consulta}` : ''}`;
  if (location.hash !== alvo) history.replaceState(null, '', alvo);
}
