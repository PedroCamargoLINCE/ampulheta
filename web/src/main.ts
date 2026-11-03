import { carregar, type Contrato } from './dados';
import { montarEstimar } from './estimar';
import { montarExplorar } from './explorar';
import { dataIso } from './formato';
import { botao, cobertura, grau, lerEstado } from './ui';

type Montar = (painel: HTMLElement, doc: Contrato) => { aplicar: (params: URLSearchParams) => void };

/** Estimar tempo é a entrada padrão; Explorar dados é a tarefa secundária. */
const ABAS: readonly { id: string; titulo: string; montar: Montar; antigos: readonly string[] }[] = [
  { id: 'estimar', titulo: 'Estimar tempo', montar: montarEstimar, antigos: ['meu-processo'] },
  { id: 'explorar', titulo: 'Explorar dados', montar: montarExplorar, antigos: [] },
];

function linhaDefinicao(lista: HTMLDListElement, termo: string, valor: string | Node, classe = ''): void {
  const dt = document.createElement('dt');
  dt.textContent = termo;
  const dd = document.createElement('dd');
  if (classe) dd.className = classe;
  dd.append(valor);
  lista.append(dt, dd);
}

/** Cobertura e data no cabeçalho: de onde e de quando são os números. */
function edicao(doc: Contrato): void {
  const alvo = document.getElementById('edicao') as HTMLDListElement;
  alvo.replaceChildren();
  linhaDefinicao(alvo, 'Cobertura', `${doc.tribunal}, ${grau(doc)}`);
  linhaDefinicao(alvo, 'Dados atualizados em', dataIso(doc.snapshot), 'num');
}

function rodape(doc: Contrato): void {
  const alvo = document.getElementById('rodape')!;
  alvo.replaceChildren();
  const citacao = document.createElement('p');
  citacao.className = 'citacao';
  citacao.textContent = `Como citar a fonte: ${doc.fonte.citacao}`;

  const colofao = document.createElement('dl');
  colofao.className = 'colofao';
  const link = document.createElement('a');
  link.href = doc.fonte.url;
  link.textContent = doc.fonte.nome;
  linhaDefinicao(colofao, 'Fonte', link);
  linhaDefinicao(colofao, 'Data de referência dos dados', dataIso(doc.snapshot));
  linhaDefinicao(colofao, 'Cobertura', cobertura(doc));
  linhaDefinicao(colofao, 'Evento', `${doc.evento.charAt(0).toLowerCase()}${doc.evento.slice(1)}`);

  const limites = document.createElement('p');
  limites.textContent =
    'O Ampulheta estima o tempo até a sentença de 1º grau. Não prevê o resultado da decisão, a chance de ganhar o processo ' +
    'nem o tempo de recursos. Não tem vínculo com o CNJ nem com os tribunais.';
  alvo.append(citacao, colofao, limites);
}

function faixaSintetica(doc: Contrato): void {
  if (!doc.sintetico || document.querySelector('.faixa-sintetica')) return;
  const faixa = document.createElement('div');
  faixa.className = 'faixa-sintetica';
  faixa.setAttribute('role', 'note');
  const interno = document.createElement('p');
  interno.className = 'container';
  interno.innerHTML =
    '<strong>Dado sintético.</strong> Estas curvas foram geradas para desenvolvimento do site e não ' +
    'representam nenhum processo real. Não use os números para decisão alguma.';
  faixa.appendChild(interno);
  document.body.prepend(faixa);
}

function montarAbas(doc: Contrato): void {
  const lista = document.getElementById('abas')!;
  const principal = document.getElementById('conteudo')!;
  const botoes: HTMLButtonElement[] = [];
  const paineis: HTMLElement[] = [];
  const telas: ReturnType<Montar>[] = [];
  lista.replaceChildren();
  principal.replaceChildren();

  for (const aba of ABAS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `aba-${aba.id}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', `painel-${aba.id}`);
    b.textContent = aba.titulo;
    lista.appendChild(b);
    botoes.push(b);

    const painel = document.createElement('section');
    painel.id = `painel-${aba.id}`;
    painel.setAttribute('role', 'tabpanel');
    painel.setAttribute('aria-labelledby', b.id);
    telas.push(aba.montar(painel, doc));
    principal.appendChild(painel);
    paineis.push(painel);
  }

  const indiceDe = (id: string) => Math.max(0, ABAS.findIndex((a) => a.id === id || a.antigos.includes(id)));

  const ativar = (indice: number, focar = false) => {
    botoes.forEach((b, i) => {
      const ativo = i === indice;
      b.setAttribute('aria-selected', String(ativo));
      b.tabIndex = ativo ? 0 : -1;
      paineis[i]!.hidden = !ativo;
    });
    if (focar) botoes[indice]!.focus();
    const id = ABAS[indice]!.id;
    if (lerEstado().aba !== id) history.replaceState(null, '', `#${id}`);
  };

  botoes.forEach((b, i) => {
    b.addEventListener('click', () => ativar(i));
    b.addEventListener('keydown', (ev) => {
      const n = botoes.length;
      if (ev.key === 'ArrowRight') ativar((i + 1) % n, true);
      else if (ev.key === 'ArrowLeft') ativar((i - 1 + n) % n, true);
      else if (ev.key === 'Home') ativar(0, true);
      else if (ev.key === 'End') ativar(n - 1, true);
      else return;
      ev.preventDefault();
    });
  });

  // Um link com recorte (#estimar?vara=…&classe=…&t=…) abre a mesma estimativa.
  const doLink = () => {
    const { aba, params } = lerEstado();
    const i = indiceDe(aba);
    if ([...params.keys()].length) telas[i]!.aplicar(params);
    ativar(i);
  };
  window.addEventListener('hashchange', doLink);
  doLink();
}

async function iniciar(): Promise<void> {
  const principal = document.getElementById('conteudo')!;
  principal.replaceChildren(Object.assign(document.createElement('p'), { className: 'nota', textContent: 'Carregando dados…' }));
  principal.firstElementChild!.setAttribute('role', 'status');
  try {
    const doc = await carregar();
    faixaSintetica(doc);
    edicao(doc);
    rodape(doc);
    montarAbas(doc);
  } catch (erro) {
    console.error(erro);
    const caixa = document.createElement('div');
    caixa.className = 'aviso aviso-erro';
    caixa.setAttribute('role', 'alert');
    const p = document.createElement('p');
    p.innerHTML = '<strong>Não foi possível carregar os dados.</strong> ';
    p.append('Pode ter sido uma falha de conexão. Tente de novo; se continuar, volte mais tarde.');
    const tentar = botao('Tentar de novo', 'secundario');
    tentar.addEventListener('click', () => void iniciar());
    caixa.append(p, tentar);
    principal.replaceChildren(caixa);
    document.getElementById('rodape')!.textContent = 'Fonte: CNJ/DataJud. Os dados não carregaram.';
  }
}

void iniciar();
