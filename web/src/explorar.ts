// Tela Explorar: curva S(t) com IC, quantis e amostra; comparação de duas curvas.
import { buscarCurva, rotuloCurva, type Contrato, type Curva } from './dados';
import { desenharGrafico, type SerieGrafico } from './grafico';
import { inteiro, meses, porcentagem } from './formato';
import { AVISO_PASSADO, criarSelect, html, opcoesClasse, opcoesVara, paraCodigo } from './ui';

interface Escolha {
  vara: string | null;
  classe: string | null;
}

function quantilTexto(valor: number | null): string {
  return valor === null ? 'não atingido na janela' : meses(valor);
}

function cartaoCurva(doc: Contrato, escolha: Escolha, curva: Curva | undefined, cor: 'a' | 'b'): HTMLElement {
  const cartao = html('section', `cartao borda-${cor}`);
  cartao.appendChild(html('h3', '', rotuloCurva(doc, escolha)));
  if (!curva) {
    cartao.appendChild(
      html(
        'p',
        'aviso',
        'Não há curva publicada para essa combinação. Curvas com menos de 30 processos ficam de fora, ' +
          'por privacidade e porque seriam ruído. Tente "Todas as varas" ou "Todas as classes".',
      ),
    );
    return cartao;
  }
  const q = curva.quantis_meses;
  const lista = html('dl', 'quantis');
  const item = (termo: string, valor: string, ajuda: string) => {
    const dt = html('dt', '', termo);
    const dd = html('dd', '');
    dd.append(html('strong', '', valor), html('span', 'ajuda', ajuda));
    lista.append(dt, dd);
  };
  item('Mediana', quantilTexto(q.p50), 'metade dos processos teve sentença até aqui');
  item('80%', quantilTexto(q.p80), 'quatro em cada cinco tiveram sentença até aqui');
  item('90%', quantilTexto(q.p90), 'nove em cada dez tiveram sentença até aqui');
  cartao.appendChild(lista);

  const amostra = html('p', 'amostra-texto');
  amostra.innerHTML =
    `<strong>${inteiro(curva.n)}</strong> processos: ${inteiro(curva.eventos)} com sentença e ` +
    `${inteiro(curva.censurados)} ainda abertos no snapshot (${porcentagem(curva.censurados / curva.n)} censurados).`;
  cartao.appendChild(amostra);
  return cartao;
}

function serie(doc: Contrato, escolha: Escolha, curva: Curva, cor: 'a' | 'b'): SerieGrafico {
  return {
    rotulo: rotuloCurva(doc, escolha),
    cor,
    meses: doc.grade_meses,
    valores: curva.sobrevivencia,
    inferior: curva.ic_inferior,
    superior: curva.ic_superior,
  };
}

function descricao(doc: Contrato, itens: { escolha: Escolha; curva: Curva }[]): string {
  const partes = itens.map(({ escolha, curva }) => {
    const p50 = curva.quantis_meses.p50;
    return `${rotuloCurva(doc, escolha)}, mediana ${p50 === null ? 'não atingida' : meses(p50)}`;
  });
  return `Curva de sobrevivência: proporção de processos ainda sem sentença ao longo dos meses. ${partes.join('; ')}.`;
}

export function montarExplorar(painel: HTMLElement, doc: Contrato): void {
  const intro = html(
    'p',
    'intro',
    'A curva mostra, mês a mês desde o ajuizamento, a proporção de processos que ainda não tinham sentença. ' +
      'Quanto mais rápido ela cai, mais rápida a vara. A faixa em volta é o intervalo de confiança de 95%.',
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());

  const grupoA = html('fieldset', 'grupo borda-a') as HTMLFieldSetElement;
  grupoA.appendChild(html('legend', '', 'Curva principal'));
  const varaA = criarSelect('explorar-vara-a', 'Vara', opcoesVara(doc), null);
  const classeA = criarSelect('explorar-classe-a', 'Classe', opcoesClasse(doc), null);
  grupoA.append(varaA.campo, classeA.campo);

  const grupoB = html('fieldset', 'grupo borda-b') as HTMLFieldSetElement;
  const legendaB = html('legend', '');
  const comparar = document.createElement('input');
  comparar.type = 'checkbox';
  comparar.id = 'explorar-comparar';
  const rotuloComparar = document.createElement('label');
  rotuloComparar.htmlFor = comparar.id;
  rotuloComparar.textContent = ' Comparar com outra curva';
  legendaB.append(comparar, rotuloComparar);
  grupoB.appendChild(legendaB);
  const varaB = criarSelect('explorar-vara-b', 'Vara', opcoesVara(doc), doc.varas[1]?.codigo ?? null);
  const classeB = criarSelect('explorar-classe-b', 'Classe', opcoesClasse(doc), null);
  grupoB.append(varaB.campo, classeB.campo);

  form.append(grupoA, grupoB);

  const cartoes = html('div', 'cartoes');
  const alvoGrafico = html('div', '');
  const notaComparacao = html('p', 'nota');
  const aviso = html('p', 'aviso-passado', AVISO_PASSADO);

  painel.append(intro, form, cartoes, alvoGrafico, notaComparacao, aviso);

  const atualizar = () => {
    const ativoB = comparar.checked;
    varaB.select.disabled = !ativoB;
    classeB.select.disabled = !ativoB;
    grupoB.classList.toggle('inativo', !ativoB);

    const escolhas: { escolha: Escolha; cor: 'a' | 'b' }[] = [
      { escolha: { vara: paraCodigo(varaA.select.value), classe: paraCodigo(classeA.select.value) }, cor: 'a' },
    ];
    if (ativoB) {
      escolhas.push({
        escolha: { vara: paraCodigo(varaB.select.value), classe: paraCodigo(classeB.select.value) },
        cor: 'b',
      });
    }

    cartoes.replaceChildren();
    const desenhaveis: { escolha: Escolha; curva: Curva; cor: 'a' | 'b' }[] = [];
    for (const { escolha, cor } of escolhas) {
      const curva = buscarCurva(doc, escolha.vara, escolha.classe);
      cartoes.appendChild(cartaoCurva(doc, escolha, curva, cor));
      if (curva) desenhaveis.push({ escolha, curva, cor });
    }

    if (desenhaveis.length === 0) {
      alvoGrafico.replaceChildren(html('p', 'aviso', 'Nenhuma curva para desenhar com essa escolha.'));
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
    }

    notaComparacao.textContent =
      desenhaveis.length === 2
        ? 'Como ler a comparação: onde as faixas não se encostam, a diferença dificilmente é acaso da amostra. ' +
          'Onde elas se sobrepõem, os dados não bastam para afirmar que uma curva é mais lenta que a outra.'
        : '';
  };

  for (const s of [varaA.select, classeA.select, varaB.select, classeB.select, comparar]) {
    s.addEventListener('change', atualizar);
  }
  atualizar();
}
