import './estilo.css';
import { carregar, type Contrato } from './dados';
import { montarExplorar } from './explorar';
import { montarMeuProcesso } from './meu-processo';
import { dataIso } from './formato';

const ABAS = [
  { id: 'explorar', titulo: 'Explorar', montar: montarExplorar },
  { id: 'meu-processo', titulo: 'Meu processo', montar: montarMeuProcesso },
] as const;

function rodape(doc: Contrato): void {
  const alvo = document.getElementById('rodape')!;
  alvo.replaceChildren();
  const citacao = document.createElement('p');
  citacao.textContent = doc.fonte.citacao;
  const detalhe = document.createElement('p');
  const link = document.createElement('a');
  link.href = doc.fonte.url;
  link.textContent = doc.fonte.nome;
  detalhe.append(
    'Fonte: ',
    link,
    `. Snapshot de ${dataIso(doc.snapshot)} · ${doc.tribunal}, ${doc.grau === 'G1' ? '1º grau' : '2º grau'} · ` +
      `evento: ${doc.evento.charAt(0).toLowerCase()}${doc.evento.slice(1)}.`,
  );
  const limites = document.createElement('p');
  limites.textContent =
    '"Sentença" aqui é o fim do 1º grau, não do processo: recursos podem estender bastante o tempo total.';
  alvo.append(citacao, detalhe, limites);
}

function faixaSintetica(doc: Contrato): void {
  if (!doc.sintetico) return;
  const faixa = document.createElement('div');
  faixa.className = 'faixa-sintetica';
  faixa.setAttribute('role', 'note');
  faixa.innerHTML =
    '<strong>Dado sintético.</strong> Estas curvas foram geradas para desenvolvimento do site e não ' +
    'representam nenhum processo real. Não use os números para decisão alguma.';
  document.body.prepend(faixa);
}

function montarAbas(doc: Contrato): void {
  const lista = document.getElementById('abas')!;
  const principal = document.getElementById('conteudo')!;
  const botoes: HTMLButtonElement[] = [];
  const paineis: HTMLElement[] = [];
  principal.replaceChildren();

  for (const aba of ABAS) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.id = `aba-${aba.id}`;
    botao.setAttribute('role', 'tab');
    botao.setAttribute('aria-controls', `painel-${aba.id}`);
    botao.textContent = aba.titulo;
    lista.appendChild(botao);
    botoes.push(botao);

    const painel = document.createElement('section');
    painel.id = `painel-${aba.id}`;
    painel.setAttribute('role', 'tabpanel');
    painel.setAttribute('aria-labelledby', botao.id);
    painel.tabIndex = 0;
    const titulo = document.createElement('h2');
    titulo.textContent = aba.titulo;
    painel.appendChild(titulo);
    aba.montar(painel, doc);
    principal.appendChild(painel);
    paineis.push(painel);
  }

  const ativar = (indice: number, focar = false) => {
    botoes.forEach((b, i) => {
      const ativo = i === indice;
      b.setAttribute('aria-selected', String(ativo));
      b.tabIndex = ativo ? 0 : -1;
      paineis[i]!.hidden = !ativo;
    });
    if (focar) botoes[indice]!.focus();
    const id = ABAS[indice]!.id;
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
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

  const daHash = () => Math.max(0, ABAS.findIndex((a) => `#${a.id}` === location.hash));
  window.addEventListener('hashchange', () => ativar(daHash()));
  ativar(daHash());
}

async function iniciar(): Promise<void> {
  try {
    const doc = await carregar();
    faixaSintetica(doc);
    rodape(doc);
    montarAbas(doc);
  } catch (erro) {
    const principal = document.getElementById('conteudo')!;
    const p = document.createElement('p');
    p.className = 'aviso';
    p.textContent = `Não foi possível carregar os dados: ${(erro as Error).message}.`;
    principal.replaceChildren(p);
    document.getElementById('rodape')!.textContent =
      'Fonte: CNJ/DataJud. Os dados não carregaram, então a data do snapshot não está disponível.';
  }
}

void iniciar();
