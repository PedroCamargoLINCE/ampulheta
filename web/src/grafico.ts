// Gráfico de S(t) em SVG feito à mão: linha, faixa do IC, guia da mediana,
// cursor por mouse e teclado, leitura em região aria-live e tabela de dados.
import { interpolar } from './sobrevivencia';
import { porcentagem } from './formato';

export interface SerieGrafico {
  rotulo: string;
  /** 'a' ou 'b': escolhe a cor nos tokens do CSS. */
  cor: 'a' | 'b';
  meses: readonly number[];
  valores: readonly number[];
  inferior?: readonly number[];
  superior?: readonly number[];
}

export interface OpcoesGrafico {
  /** Texto alternativo: resumo do que o gráfico mostra. */
  descricao: string;
  rotuloX: string;
  rotuloY: string;
}

const SVG = 'http://www.w3.org/2000/svg';
const LARGURA = 720;
const ALTURA = 340;
const M = { esq: 52, dir: 16, topo: 14, base: 46 };
const LIMIAR_FIM = 0.02;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  pai?: Element,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  pai?.appendChild(n);
  return n;
}

/** Corta o eixo X onde todas as curvas (e seus IC) já ficaram abaixo de 2%, em múltiplo de 12. */
function limiteX(series: readonly SerieGrafico[]): number {
  let fim = 0;
  let maximo = 0;
  for (const s of series) {
    const ultimo = s.meses[s.meses.length - 1] ?? 0;
    maximo = Math.max(maximo, ultimo);
    const topo = s.superior ?? s.valores;
    const i = topo.findIndex((v) => v < LIMIAR_FIM);
    fim = Math.max(fim, i === -1 ? ultimo : (s.meses[i] ?? ultimo));
  }
  const passo = maximo > 24 ? 12 : 3;
  return Math.min(maximo, Math.max(passo, Math.ceil(fim / passo) * passo));
}

function caminho(meses: readonly number[], valores: readonly number[], x: (m: number) => number, y: (v: number) => number, ate: number): string {
  const partes: string[] = [];
  for (let i = 0; i < meses.length; i++) {
    const m = meses[i]!;
    if (m > ate) break;
    partes.push(`${i === 0 ? 'M' : 'L'}${x(m).toFixed(1)},${y(valores[i]!).toFixed(1)}`);
  }
  return partes.join('');
}

function faixa(s: SerieGrafico, x: (m: number) => number, y: (v: number) => number, ate: number): string {
  const sup = caminho(s.meses, s.superior!, x, y, ate);
  const pontos: string[] = [];
  for (let i = s.meses.length - 1; i >= 0; i--) {
    const m = s.meses[i]!;
    if (m > ate) continue;
    pontos.push(`L${x(m).toFixed(1)},${y(s.inferior![i]!).toFixed(1)}`);
  }
  return `${sup}${pontos.join('')}Z`;
}

function leitura(series: readonly SerieGrafico[], mes: number, rotuloMes: (m: number) => string): string {
  const partes = series.map((s) => {
    const v = interpolar(s.meses, s.valores, mes);
    if (v === null) return `${s.rotulo}: fora da janela`;
    let texto = `${s.rotulo}: ${porcentagem(v)} ainda sem sentença`;
    if (s.inferior && s.superior) {
      const lo = interpolar(s.meses, s.inferior, mes)!;
      const hi = interpolar(s.meses, s.superior, mes)!;
      texto += ` (IC 95%: ${porcentagem(lo)} a ${porcentagem(hi)})`;
    }
    return texto;
  });
  return `${rotuloMes(mes)} — ${partes.join('; ')}.`;
}

export function desenharGrafico(
  alvo: HTMLElement,
  series: readonly SerieGrafico[],
  opcoes: OpcoesGrafico,
): void {
  alvo.replaceChildren();
  const ate = limiteX(series);
  const larguraUtil = LARGURA - M.esq - M.dir;
  const alturaUtil = ALTURA - M.topo - M.base;
  const x = (m: number) => M.esq + (m / ate) * larguraUtil;
  const y = (v: number) => M.topo + (1 - v) * alturaUtil;
  const rotuloMes = (m: number) => `${m} ${m === 1 ? 'mês' : 'meses'}`;

  const figura = document.createElement('figure');
  figura.className = 'grafico';

  const svg = el('svg', {
    viewBox: `0 0 ${LARGURA} ${ALTURA}`,
    role: 'img',
    tabindex: 0,
    'aria-label': `${opcoes.descricao} Use as setas para percorrer os meses.`,
  });
  figura.appendChild(svg);

  // Grade e eixos.
  const eixos = el('g', { class: 'eixos' }, svg);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    el('line', { x1: M.esq, x2: LARGURA - M.dir, y1: y(v), y2: y(v), class: v === 0 ? 'eixo' : 'grade' }, eixos);
    const t = el('text', { x: M.esq - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, eixos);
    t.textContent = `${v * 100}%`;
  }
  const passo = ate > 60 ? 12 : ate > 24 ? 6 : 3;
  for (let m = 0; m <= ate; m += passo) {
    el('line', { x1: x(m), x2: x(m), y1: y(0), y2: y(0) + 5, class: 'eixo' }, eixos);
    const t = el('text', { x: x(m), y: y(0) + 18, class: 'tick', 'text-anchor': 'middle' }, eixos);
    t.textContent = String(m);
  }
  const rx = el('text', { x: M.esq + larguraUtil / 2, y: ALTURA - 6, class: 'rotulo-eixo', 'text-anchor': 'middle' }, eixos);
  rx.textContent = opcoes.rotuloX;
  const ry = el('text', { x: 14, y: M.topo + alturaUtil / 2, class: 'rotulo-eixo', 'text-anchor': 'middle', transform: `rotate(-90 14 ${M.topo + alturaUtil / 2})` }, eixos);
  ry.textContent = opcoes.rotuloY;

  // Guia da mediana: onde a curva cruza 50%.
  el('line', { x1: M.esq, x2: LARGURA - M.dir, y1: y(0.5), y2: y(0.5), class: 'guia-mediana' }, svg);
  const tm = el('text', { x: LARGURA - M.dir - 4, y: y(0.5) - 6, class: 'tick', 'text-anchor': 'end' }, svg);
  tm.textContent = 'mediana';

  // Faixas primeiro, linhas por cima.
  for (const s of series) {
    if (s.inferior && s.superior) el('path', { d: faixa(s, x, y, ate), class: `faixa cor-${s.cor}` }, svg);
  }
  for (const s of series) {
    el('path', { d: caminho(s.meses, s.valores, x, y, ate), class: `linha cor-${s.cor}` }, svg);
  }

  // Cursor.
  const cursor = el('g', { class: 'cursor', visibility: 'hidden' }, svg);
  const linhaCursor = el('line', { y1: M.topo, y2: y(0), class: 'linha-cursor' }, cursor);
  const pontos = series.map((s) => el('circle', { r: 4.5, class: `ponto cor-${s.cor}` }, cursor));

  const legenda = document.createElement('ul');
  legenda.className = 'legenda';
  for (const s of series) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="amostra cor-${s.cor}" aria-hidden="true"></span>`;
    li.append(s.rotulo);
    legenda.appendChild(li);
  }
  if (series.some((s) => s.inferior)) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="amostra faixa-amostra" aria-hidden="true"></span>faixa = intervalo de confiança de 95%';
    legenda.appendChild(li);
  }
  figura.appendChild(legenda);

  const saida = document.createElement('p');
  saida.className = 'leitura';
  saida.setAttribute('aria-live', 'polite');
  saida.textContent = 'Passe o mouse ou use as setas sobre o gráfico para ler os valores mês a mês.';
  figura.appendChild(saida);

  let mesAtual = 0;
  const mover = (m: number) => {
    mesAtual = Math.max(0, Math.min(ate, Math.round(m)));
    cursor.setAttribute('visibility', 'visible');
    linhaCursor.setAttribute('x1', String(x(mesAtual)));
    linhaCursor.setAttribute('x2', String(x(mesAtual)));
    series.forEach((s, i) => {
      const v = interpolar(s.meses, s.valores, mesAtual);
      const p = pontos[i]!;
      p.setAttribute('visibility', v === null ? 'hidden' : 'visible');
      if (v !== null) {
        p.setAttribute('cx', String(x(mesAtual)));
        p.setAttribute('cy', String(y(v)));
      }
    });
    saida.textContent = leitura(series, mesAtual, rotuloMes);
  };

  svg.addEventListener('pointermove', (ev) => {
    const caixa = svg.getBoundingClientRect();
    const px = ((ev.clientX - caixa.left) / caixa.width) * LARGURA;
    mover(((px - M.esq) / larguraUtil) * ate);
  });
  svg.addEventListener('pointerleave', () => cursor.setAttribute('visibility', 'hidden'));
  svg.addEventListener('focus', () => mover(mesAtual));
  svg.addEventListener('blur', () => cursor.setAttribute('visibility', 'hidden'));
  svg.addEventListener('keydown', (ev) => {
    const passos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, PageUp: 12, PageDown: -12 };
    if (ev.key in passos) mover(mesAtual + passos[ev.key]!);
    else if (ev.key === 'Home') mover(0);
    else if (ev.key === 'End') mover(ate);
    else return;
    ev.preventDefault();
  });

  figura.appendChild(tabelaDados(series, ate, opcoes.rotuloX));
  alvo.appendChild(figura);
}

/** Os mesmos números em tabela, para leitor de tela e para quem quer copiar. */
function tabelaDados(series: readonly SerieGrafico[], ate: number, rotuloX: string): HTMLDetailsElement {
  const detalhes = document.createElement('details');
  detalhes.className = 'tabela-dados';
  const resumo = document.createElement('summary');
  resumo.textContent = 'Ver os dados do gráfico em tabela';
  detalhes.appendChild(resumo);

  const tabela = document.createElement('table');
  const cab = tabela.createTHead().insertRow();
  const th = (texto: string) => {
    const c = document.createElement('th');
    c.scope = 'col';
    c.textContent = texto;
    cab.appendChild(c);
  };
  th(rotuloX);
  for (const s of series) {
    th(`${s.rotulo}: sem sentença`);
    if (s.inferior && s.superior) th(`${s.rotulo}: IC 95%`);
  }
  const corpo = tabela.createTBody();
  for (let m = 0; m <= ate; m++) {
    const linha = corpo.insertRow();
    const cabLinha = document.createElement('th');
    cabLinha.scope = 'row';
    cabLinha.textContent = String(m);
    linha.appendChild(cabLinha);
    for (const s of series) {
      const v = interpolar(s.meses, s.valores, m);
      linha.insertCell().textContent = v === null ? '—' : porcentagem(v);
      if (s.inferior && s.superior) {
        const lo = interpolar(s.meses, s.inferior, m);
        const hi = interpolar(s.meses, s.superior, m);
        linha.insertCell().textContent = lo === null || hi === null ? '—' : `${porcentagem(lo)} a ${porcentagem(hi)}`;
      }
    }
  }
  const rolagem = document.createElement('div');
  rolagem.className = 'rolagem';
  rolagem.appendChild(tabela);
  detalhes.appendChild(rolagem);
  return detalhes;
}
