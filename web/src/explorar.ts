// Tela Explorar dados: processos ainda sem sentença ao longo do tempo, com intervalo de
// confiança, prazos e base; comparação opcional com outro recorte (docs/DESIGN.md, seção 4).
import { buscarCurva, rotuloCurva, type Contrato, type Curva } from './dados';
import { desenharGrafico, type SerieGrafico } from './grafico';
import { dataIso, inteiro, meses, porcentagem } from './formato';
import { ate, mesComBase, MIN_EM_RISCO } from './base';
import {
  TODAS,
  aviso,
  comoCalculamos,
  criarBancada,
  criarSelect,
  deCodigo,
  gravarEstado,
  grau,
  html,
  limitacoes,
  opcoesClasse,
  opcoesVara,
  paraCodigo,
} from './ui';

const ABA = 'explorar';

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

/** Série cortada onde a curva deixa de ter base (contrato 1.2.0, `em_risco`). */
function serie(doc: Contrato, escolha: Escolha, curva: Curva, cor: 'a' | 'b'): SerieGrafico | null {
  const corte = mesComBase(doc.grade_meses, curva);
  if (corte === null) return null;
  const s = ate(doc.grade_meses, curva.sobrevivencia, corte);
  const n = s.grade.length;
  const p50 = curva.quantis_meses.p50;
  return {
    rotulo: rotuloCurva(doc, escolha),
    cor,
    meses: s.grade,
    valores: s.serie,
    inferior: curva.ic_inferior.slice(0, n),
    superior: curva.ic_superior.slice(0, n),
    marcas: p50 === null || p50 > corte ? [] : [{ mes: p50, valor: 0.5, rotulo: `${decimal.format(p50)} meses` }],
  };
}

/** Prazo da tabela: valor, não atingido ou fora do trecho com base, sempre por extenso. */
function prazo(valor: number | null, corte: number | null): string {
  if (valor === null) return 'não atingido';
  if (corte === null || valor > corte) return 'base pequena';
  return decimal.format(valor);
}

function tabelaPrazos(doc: Contrato, itens: Item[]): HTMLTableElement {
  const tabela = document.createElement('table');
  tabela.className = 'tabela tabela-quantis';
  const cab = tabela.createTHead().insertRow();
  const canto = document.createElement('th');
  canto.scope = 'col';
  canto.textContent = 'Meses desde o ajuizamento';
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
      td.textContent = curva ? valor(curva) : 'Sem estimativa para este recorte';
    }
  };
  const corte = (c: Curva) => mesComBase(doc.grade_meses, c);
  linha('Metade com sentença até', '', (c) => prazo(c.quantis_meses.p50, corte(c)));
  linha('80% com sentença até', '', (c) => prazo(c.quantis_meses.p80, corte(c)));
  linha('90% com sentença até', '', (c) => prazo(c.quantis_meses.p90, corte(c)));
  linha('Processos na base', '', (c) => inteiro(c.n));
  linha('Sem sentença observada', '', (c) => `${inteiro(c.censurados)} (${porcentagem(c.censurados / c.n)})`);
  return tabela;
}

export function montarExplorar(painel: HTMLElement, doc: Contrato): { aplicar: (params: URLSearchParams) => void } {
  const { controles, folha } = criarBancada(painel);

  controles.append(
    html('h2', '', 'Quanto tempo leva até a sentença?'),
    html('p', 'intro', 'Cada curva mostra quantos processos ainda estavam sem sentença, mês a mês desde o ajuizamento.'),
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());

  const grupoA = html('fieldset', 'grupo') as HTMLFieldSetElement;
  const legendaA = html('legend', '');
  legendaA.innerHTML = '<span class="amostra cor-a" aria-hidden="true"></span>';
  legendaA.append('Recorte');
  grupoA.appendChild(legendaA);
  const varaA = criarSelect('explorar-vara-a', 'Vara', opcoesVara(doc), TODAS);
  const classeA = criarSelect('explorar-classe-a', 'Classe processual', opcoesClasse(doc), TODAS);
  grupoA.append(varaA.campo, classeA.campo);

  const grupoB = html('fieldset', 'grupo') as HTMLFieldSetElement;
  const legendaB = html('legend', '');
  const comparar = document.createElement('input');
  comparar.type = 'checkbox';
  comparar.id = 'explorar-comparar';
  comparar.setAttribute('aria-controls', 'explorar-campos-b');
  const rotuloComparar = document.createElement('label');
  rotuloComparar.htmlFor = comparar.id;
  rotuloComparar.textContent = 'Comparar com outro recorte';
  legendaB.append(comparar, rotuloComparar);
  legendaB.insertAdjacentHTML('beforeend', '<span class="amostra cor-b" aria-hidden="true"></span>');
  grupoB.appendChild(legendaB);
  const camposB = html('div', 'campos-b');
  camposB.id = 'explorar-campos-b';
  const varaB = criarSelect('explorar-vara-b', 'Vara do segundo recorte', opcoesVara(doc), doc.varas[0]?.codigo ?? TODAS);
  const classeB = criarSelect('explorar-classe-b', 'Classe do segundo recorte', opcoesClasse(doc), TODAS);
  camposB.append(varaB.campo, classeB.campo);
  grupoB.appendChild(camposB);

  form.append(grupoA, grupoB);
  controles.appendChild(form);

  const cabeca = html('div', 'folha-cabeca');
  const titulo = html('h3', '');
  cabeca.append(titulo, html('p', 'citacao-resultado', `${doc.tribunal} · ${grau(doc)} · dados até ${dataIso(doc.snapshot)}`));
  const avisos = html('div', 'avisos');
  const alvoGrafico = html('div', 'alvo-grafico');
  const alvoTabela = html('div', '');
  folha.append(
    cabeca,
    avisos,
    alvoGrafico,
    alvoTabela,
    html('p', 'limitacoes', `${limitacoes(doc)} Não mede a qualidade do trabalho de uma vara.`),
    comoCalculamos(doc),
  );

  const atualizar = (gravar = true) => {
    const ativoB = comparar.checked;
    camposB.hidden = !ativoB;

    const itens: Item[] = [
      { escolha: { vara: paraCodigo(varaA.controle.value), classe: paraCodigo(classeA.controle.value) }, cor: 'a', curva: undefined },
    ];
    if (ativoB) {
      itens.push({
        escolha: { vara: paraCodigo(varaB.controle.value), classe: paraCodigo(classeB.controle.value) },
        cor: 'b',
        curva: undefined,
      });
    }
    for (const item of itens) item.curva = buscarCurva(doc, item.escolha.vara, item.escolha.classe);

    const series = itens.flatMap(({ escolha, curva, cor }) => {
      const s = curva ? serie(doc, escolha, curva, cor) : null;
      return s ? [s] : [];
    });
    const faltando = itens.filter((i) => i.curva === undefined);

    titulo.textContent = itens.length === 2 ? 'Comparação de dois recortes' : rotuloCurva(doc, itens[0]!.escolha);
    avisos.replaceChildren();
    if (faltando.length > 0) {
      avisos.appendChild(
        aviso(
          'info',
          `Sem curva para ${faltando.map((i) => rotuloCurva(doc, i.escolha)).join(' nem para ')}: menos de 30 processos na base.`,
        ),
      );
    }
    if (itens.length === 2 && series.length === 2) {
      const [a, b] = itens as [Item, Item];
      if (a.escolha.classe !== b.escolha.classe) {
        avisos.appendChild(
          aviso('atencao', 'Classes diferentes: parte da diferença pode vir do tipo de processo, e não da vara.'),
        );
      }
    }
    avisos.hidden = avisos.childElementCount === 0;

    const cortadas = series.filter((s) => (s.meses.at(-1) ?? 0) < (doc.grade_meses.at(-1) ?? 0));
    if (series.length === 0) {
      alvoGrafico.replaceChildren();
      alvoTabela.replaceChildren();
    } else {
      desenharGrafico(alvoGrafico, series, {
        descricao:
          'Proporção de processos ainda sem sentença a cada mês desde o ajuizamento. ' +
          series
            .map((s) => {
              const m = s.marcas?.[0];
              return `${s.rotulo}: metade teve sentença ${m ? `até ${meses(m.mes)}` : 'em prazo não estimado no período observado'}`;
            })
            .join('; ') +
          '.',
        rotuloX: 'meses desde o ajuizamento',
        rotuloY: 'ainda sem sentença',
        rotuloMes: (m) => meses(m),
        nota: cortadas.length
          ? `${series.length === 1 ? 'A curva termina' : 'Cada curva termina'} onde menos de ${MIN_EM_RISCO} processos do recorte seguiam em acompanhamento, ou no fim do período observado.`
          : undefined,
      });
      const rolagem = html('div', 'quantis-rolagem');
      rolagem.tabIndex = 0;
      rolagem.setAttribute('role', 'region');
      rolagem.setAttribute('aria-label', 'Prazos e base de cada recorte, rolável');
      rolagem.appendChild(tabelaPrazos(doc, itens));
      alvoTabela.replaceChildren(rolagem);
    }

    if (gravar) {
      const params = new URLSearchParams({ vara: deCodigo(itens[0]!.escolha.vara), classe: deCodigo(itens[0]!.escolha.classe) });
      if (ativoB) {
        params.set('vara2', varaB.controle.value);
        params.set('classe2', classeB.controle.value);
      }
      gravarEstado(ABA, params);
    }
  };

  for (const s of [varaA.controle, classeA.controle, varaB.controle, classeB.controle, comparar]) {
    s.addEventListener('change', () => atualizar());
  }
  atualizar(false);

  const valido = (s: HTMLSelectElement, v: string | null): v is string => v !== null && [...s.options].some((o) => o.value === v);
  return {
    aplicar(params) {
      const pares: [HTMLSelectElement, string | null][] = [
        [varaA.controle, params.get('vara')],
        [classeA.controle, params.get('classe')],
      ];
      for (const [s, v] of pares) if (valido(s, v)) s.value = v;
      const v2 = params.get('vara2');
      const c2 = params.get('classe2');
      comparar.checked = valido(varaB.controle, v2) && valido(classeB.controle, c2);
      if (comparar.checked) {
        varaB.controle.value = v2!;
        classeB.controle.value = c2!;
      }
      atualizar(false);
    },
  };
}
