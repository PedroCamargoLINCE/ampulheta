// Tela Explorar: curva S(t) com IC, quantis e amostra; comparação de duas curvas.
import { buscarCurva, rotuloCurva, type Contrato, type Curva } from './dados';
import { desenharGrafico, type SerieGrafico } from './grafico';
import { inteiro, meses, porcentagem } from './formato';
import { AVISO_PASSADO, criarBancada, criarSelect, html, opcoesClasse, opcoesVara, paraCodigo } from './ui';

interface Escolha {
  vara: string | null;
  classe: string | null;
}

interface Item {
  escolha: Escolha;
  curva: Curva | undefined;
  cor: 'a' | 'b';
}

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function serie(doc: Contrato, escolha: Escolha, curva: Curva, cor: 'a' | 'b'): SerieGrafico {
  const p50 = curva.quantis_meses.p50;
  return {
    rotulo: rotuloCurva(doc, escolha),
    cor,
    meses: doc.grade_meses,
    valores: curva.sobrevivencia,
    inferior: curva.ic_inferior,
    superior: curva.ic_superior,
    marcas: p50 === null ? [] : [{ mes: p50, valor: 0.5, rotulo: `${decimal.format(p50)} meses` }],
  };
}

function descricao(doc: Contrato, itens: { escolha: Escolha; curva: Curva }[]): string {
  const partes = itens.map(({ escolha, curva }) => {
    const p50 = curva.quantis_meses.p50;
    return `${rotuloCurva(doc, escolha)}, mediana ${p50 === null ? 'não atingida' : meses(p50)}`;
  });
  return `Curva de sobrevivência: proporção de processos ainda sem sentença ao longo dos meses. ${partes.join('; ')}.`;
}

/** Quantis e amostra, uma coluna por curva, no jeito da tabela impressa. */
function tabelaQuantis(doc: Contrato, itens: Item[]): HTMLTableElement {
  const tabela = document.createElement('table');
  tabela.className = 'tabela tabela-quantis';
  const cab = tabela.createTHead().insertRow();
  const canto = document.createElement('th');
  canto.scope = 'col';
  canto.textContent = 'Em meses desde o ajuizamento';
  cab.appendChild(canto);
  for (const { escolha, cor } of itens) {
    const c = document.createElement('th');
    c.scope = 'col';
    c.className = 'num';
    c.innerHTML = `<span class="amostra cor-${cor}" aria-hidden="true"></span>`;
    c.append(rotuloCurva(doc, escolha));
    cab.appendChild(c);
  }

  const corpo = tabela.createTBody();
  const linha = (rotulo: string, ajuda: string, valor: (c: Curva) => string) => {
    const tr = corpo.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = rotulo;
    if (ajuda) th.appendChild(html('span', '', ajuda));
    tr.appendChild(th);
    for (const { curva } of itens) {
      const td = tr.insertCell();
      td.className = 'num';
      td.textContent = curva ? valor(curva) : 'sem curva';
    }
  };
  const q = (v: number | null) => (v === null ? '—' : decimal.format(v));
  linha('Mediana', 'metade dos processos teve sentença até aqui', (c) => q(c.quantis_meses.p50));
  linha('80%', 'quatro em cada cinco tiveram sentença até aqui', (c) => q(c.quantis_meses.p80));
  linha('90%', 'nove em cada dez tiveram sentença até aqui', (c) => q(c.quantis_meses.p90));
  linha('Processos', '', (c) => inteiro(c.n));
  linha('Com sentença', '', (c) => inteiro(c.eventos));
  linha('Ainda abertos no snapshot', 'censurados', (c) => inteiro(c.censurados));
  linha('Parcela censurada', '', (c) => porcentagem(c.censurados / c.n));

  const legenda = document.createElement('caption');
  legenda.textContent = '— quantil não atingido na janela dos dados.';
  tabela.appendChild(legenda);
  return tabela;
}

export function montarExplorar(painel: HTMLElement, doc: Contrato): void {
  const { controles, folha } = criarBancada(painel);

  const titulo = html('h2', '', 'Quanto tempo cada vara leva até a sentença');
  const intro = html(
    'p',
    'intro',
    'A curva mostra, mês a mês desde o ajuizamento, a proporção de processos que ainda não tinham sentença. ' +
      'Quanto mais rápido ela cai, mais rápida a vara. A faixa em volta é o intervalo de confiança de 95%.',
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());

  const grupoA = html('fieldset', 'grupo') as HTMLFieldSetElement;
  const legendaA = html('legend', '');
  legendaA.innerHTML = '<span class="amostra cor-a" aria-hidden="true"></span>';
  legendaA.append('Curva principal');
  grupoA.appendChild(legendaA);
  const varaA = criarSelect('explorar-vara-a', 'Vara', opcoesVara(doc), null);
  const classeA = criarSelect('explorar-classe-a', 'Classe', opcoesClasse(doc), null);
  grupoA.append(varaA.campo, classeA.campo);

  const grupoB = html('fieldset', 'grupo') as HTMLFieldSetElement;
  const legendaB = html('legend', '');
  const comparar = document.createElement('input');
  comparar.type = 'checkbox';
  comparar.id = 'explorar-comparar';
  const rotuloComparar = document.createElement('label');
  rotuloComparar.htmlFor = comparar.id;
  rotuloComparar.textContent = 'Comparar com outra curva';
  legendaB.append(comparar, rotuloComparar);
  legendaB.insertAdjacentHTML('beforeend', '<span class="amostra cor-b" aria-hidden="true"></span>');
  grupoB.appendChild(legendaB);
  const varaB = criarSelect('explorar-vara-b', 'Vara', opcoesVara(doc), doc.varas[1]?.codigo ?? null);
  const classeB = criarSelect('explorar-classe-b', 'Classe', opcoesClasse(doc), null);
  grupoB.append(varaB.campo, classeB.campo);

  form.append(grupoA, grupoB);

  const notaComparacao = html('p', 'nota');
  const aviso = html('p', 'aviso-passado', AVISO_PASSADO);
  controles.append(titulo, intro, form, notaComparacao);

  const cabeca = html('div', 'folha-cabeca');
  const amostras = html('div', 'folha-amostras');
  cabeca.append(
    html('h3', '', 'Ainda sem sentença, mês a mês'),
    html('p', '', `${doc.tribunal}, ${doc.grau === 'G1' ? '1º grau' : '2º grau'}. Curvas Kaplan-Meier com intervalo de confiança de 95%.`),
    amostras,
  );
  const alvoGrafico = html('div', '');
  const alvoTabela = html('div', '');
  const avisoFolha = html('div', '');
  folha.append(cabeca, alvoGrafico, avisoFolha, alvoTabela, aviso);

  const atualizar = () => {
    const ativoB = comparar.checked;
    varaB.select.disabled = !ativoB;
    classeB.select.disabled = !ativoB;
    grupoB.classList.toggle('inativo', !ativoB);

    const itens: Item[] = [{ escolha: { vara: paraCodigo(varaA.select.value), classe: paraCodigo(classeA.select.value) }, cor: 'a', curva: undefined }];
    if (ativoB) {
      itens.push({ escolha: { vara: paraCodigo(varaB.select.value), classe: paraCodigo(classeB.select.value) }, cor: 'b', curva: undefined });
    }
    for (const item of itens) item.curva = buscarCurva(doc, item.escolha.vara, item.escolha.classe);

    const desenhaveis = itens.filter((i): i is Item & { curva: Curva } => i.curva !== undefined);
    const faltando = itens.filter((i) => i.curva === undefined);

    amostras.replaceChildren(
      ...desenhaveis.map(({ curva, cor }) => {
        const p = html('p', 'amostra-texto');
        p.innerHTML = `<span class="amostra cor-${cor}" aria-hidden="true"></span>`;
        p.append(
          `${inteiro(curva.n)} processos: ${inteiro(curva.eventos)} com sentença e ` +
            `${inteiro(curva.censurados)} ainda abertos no snapshot (${porcentagem(curva.censurados / curva.n)} censurados).`,
        );
        return p;
      }),
    );

    avisoFolha.replaceChildren();
    avisoFolha.hidden = faltando.length === 0;
    if (faltando.length > 0) {
      avisoFolha.appendChild(
        html(
          'p',
          'aviso',
          `Não há curva publicada para ${faltando.map((i) => rotuloCurva(doc, i.escolha)).join(' nem para ')}. ` +
            'Curvas com menos de 30 processos ficam de fora, por privacidade e porque seriam ruído. ' +
            'Tente “Todas as varas” ou “Todas as classes”.',
        ),
      );
    }

    if (desenhaveis.length === 0) {
      alvoGrafico.replaceChildren();
      alvoTabela.replaceChildren();
    } else {
      desenharGrafico(
        alvoGrafico,
        desenhaveis.map(({ escolha, curva, cor }) => serie(doc, escolha, curva, cor)),
        {
          descricao: descricao(doc, desenhaveis),
          rotuloX: 'meses desde o ajuizamento',
          rotuloY: 'ainda sem sentença',
        },
      );
      const rolagem = html('div', 'quantis-rolagem');
      rolagem.appendChild(tabelaQuantis(doc, itens));
      alvoTabela.replaceChildren(rolagem);
    }

    notaComparacao.textContent =
      desenhaveis.length === 2
        ? 'Como ler a comparação: onde as faixas não se encostam, a diferença dificilmente é acaso da amostra. ' +
          'Onde elas se sobrepõem, os dados não bastam para afirmar que uma curva é mais lenta que a outra.'
        : '';
    notaComparacao.hidden = desenhaveis.length !== 2;
  };

  for (const s of [varaA.select, classeA.select, varaB.select, classeB.select, comparar]) {
    s.addEventListener('change', atualizar);
  }
  atualizar();
}
