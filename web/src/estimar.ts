// Tela Estimar tempo: probabilidade estimada de sentença nos próximos 3, 6 e 12 meses,
// para um processo que segue sem sentença depois de t meses (docs/DESIGN.md, seções 4, 5 e 9).
import { buscarCurva, rotuloCurva, type Contrato, type Curva } from './dados';
import { desenharGrafico } from './grafico';
import { dataIso, inteiro, meses, porcentagem } from './formato';
import {
  curvaCondicional,
  horizonte,
  interpolar,
  intervaloSentenca,
  probabilidadeSentenca,
  quantilCondicional,
} from './sobrevivencia';
import { ate, emRiscoEm, mesComBase, MIN_EM_RISCO } from './base';
import {
  NADA,
  TODAS,
  aviso,
  botao,
  cobertura,
  comoCalculamos,
  criarBancada,
  criarConfirmacao,
  criarEntrada,
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

const ABA = 'estimar';
const HORIZONTES = [3, 6, 12] as const;
/** Só para contratos sem `em_risco`: S(t) baixo é sinal de instabilidade, não contagem de casos. */
const S_SINAL_INSTAVEL = 0.05;

interface Escolha {
  vara: string | null;
  classe: string | null;
  t: number;
}

type Cartao =
  | { tipo: 'ok'; valor: number; ic: { inferior: number; superior: number } | null; temGreenwood: boolean }
  | { tipo: 'horizonte'; motivo: string }
  | { tipo: 'base'; motivo: string };

/** Meses completos entre a data (aaaa-mm-dd) e hoje; null se a data é inválida ou futura. */
function mesesAteHoje(iso: string, hoje = new Date()): number | null {
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return null;
  let total = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  if (hoje.getDate() < d) total -= 1;
  return total < 0 ? null : total;
}

function hojeIso(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

function maisMeses(m: number): string {
  return `+${meses(m)}`;
}

export function montarEstimar(painel: HTMLElement, doc: Contrato): { aplicar: (params: URLSearchParams) => void } {
  const fim = horizonte(doc.grade_meses);
  const { controles, folha } = criarBancada(painel);

  controles.append(
    html('h2', '', 'Estimar o tempo até a sentença'),
    html(
      'p',
      'intro',
      'Para um processo que ainda não teve sentença de 1º grau, estimamos a probabilidade de sentença nos próximos 3, 6 e 12 meses, ' +
        'com base em processos do mesmo recorte.',
    ),
    html('p', 'cobertura', `Dados de ${cobertura(doc)}, atualizados em ${dataIso(doc.snapshot)}.`),
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.noValidate = true;
  const grupo = html('fieldset', 'grupo') as HTMLFieldSetElement;
  grupo.appendChild(html('legend', '', 'Seu processo'));

  const vara = criarSelect(
    'estimar-vara',
    'Vara',
    opcoesVara(doc, 'Escolha a vara'),
    NADA,
    `Aparece na capa do processo e na consulta processual do ${doc.tribunal}. “Todas as varas” junta as ${doc.varas.length} varas da base.`,
  );
  const classe = criarSelect(
    'estimar-classe',
    'Classe processual',
    opcoesClasse(doc, 'Escolha a classe'),
    NADA,
    'É o tipo de ação, como “Procedimento Comum Cível” ou um despejo. Aparece na capa do processo e na consulta processual.',
  );
  const tempo = criarEntrada(
    'estimar-meses',
    'Tempo desde o ajuizamento, em meses',
    { type: 'text', inputMode: 'numeric', autocomplete: 'off' },
    `Meses completos desde o ajuizamento até hoje, de 0 a ${fim}.`,
  );
  const data = criarEntrada(
    'estimar-data',
    'Ou informe a data do ajuizamento',
    { type: 'date', max: hojeIso() },
    'Preenche o campo acima com os meses completos até hoje.',
  );
  const confirmacao = criarConfirmacao('estimar-sem-sentenca', 'O processo ainda não teve sentença de 1º grau');
  grupo.append(vara.campo, classe.campo, tempo.campo, data.campo, confirmacao.campo);

  const calcular = botao('Calcular estimativa', 'principal', 'submit');
  const exemplo = botao('Preencher um exemplo', 'secundario');
  const acoes = html('div', 'acoes');
  acoes.append(calcular, exemplo);
  form.append(grupo, acoes);
  controles.appendChild(form);

  // Anúncio curto, uma vez por cálculo, em vez de reler a folha inteira a cada tecla.
  const status = html('p', 'visually-hidden');
  status.setAttribute('role', 'status');
  painel.appendChild(status);

  let ultima: Escolha | null = null;
  let desatualizado = false;

  const estadoInicial = () => {
    const vazio = html('div', 'vazio');
    vazio.append(
      html('h3', '', 'O resultado aparece aqui'),
      html(
        'p',
        '',
        'Preencha vara, classe e tempo de tramitação, confirme que ainda não houve sentença e clique em “Calcular estimativa”. ' +
          'Nenhum número aparece antes disso.',
      ),
    );
    folha.replaceChildren(vazio, comoCalculamos(doc));
  };

  const marcarDesatualizado = () => {
    if (!ultima || desatualizado) return;
    desatualizado = true;
    folha.classList.add('desatualizado');
    const banda = aviso(
      'info',
      `Este resultado é da seleção anterior (${rotuloCurva(doc, ultima)}, tramitando há ${meses(ultima.t)}).`,
      'Clique em “Calcular estimativa” para atualizar.',
    );
    banda.classList.add('aviso-anterior');
    folha.prepend(banda);
  };

  const validar = (): Escolha | null => {
    const erros: HTMLElement[] = [];
    for (const [campo, nome] of [
      [vara, 'a vara, ou “Todas as varas”'],
      [classe, 'a classe, ou “Todas as classes”'],
    ] as const) {
      if (campo.controle.value === NADA) {
        campo.erro(`Escolha ${nome}.`);
        erros.push(campo.controle);
      } else campo.erro(null);
    }
    const bruto = tempo.controle.value.trim();
    let t = NaN;
    if (bruto === '') tempo.erro('Informe há quantos meses o processo tramita, ou a data do ajuizamento.');
    else if (!/^\d+$/.test(bruto)) tempo.erro('Informe um número inteiro de meses, sem vírgula. Por exemplo: 18.');
    else if (Number(bruto) > fim)
      tempo.erro(`Os dados cobrem até ${fim} meses de tramitação. Informe um valor de 0 a ${fim}.`);
    else {
      t = Number(bruto);
      tempo.erro(null);
    }
    if (Number.isNaN(t)) erros.push(tempo.controle);
    if (!confirmacao.controle.checked) {
      confirmacao.erro('A estimativa só vale para processos ainda sem sentença de 1º grau. Marque para continuar.');
      erros.push(confirmacao.controle);
    } else confirmacao.erro(null);

    if (erros.length) {
      erros[0]!.focus();
      status.textContent = `${erros.length === 1 ? 'Um campo precisa' : `${erros.length} campos precisam`} de correção.`;
      return null;
    }
    return { vara: paraCodigo(vara.controle.value), classe: paraCodigo(classe.controle.value), t };
  };

  const cartaoPara = (curva: Curva, corte: number, t: number, h: number): Cartao => {
    if (t + h > fim) {
      return { tipo: 'horizonte', motivo: `Os dados cobrem até ${fim} meses de tramitação, e ${meses(t + h)} passa desse limite.` };
    }
    if (t + h > corte) {
      return {
        tipo: 'base',
        motivo: `Menos de ${MIN_EM_RISCO} processos do recorte seguiam sem sentença e em acompanhamento aos ${meses(t + h)}.`,
      };
    }
    const r = probabilidadeSentenca(doc.grade_meses, curva.sobrevivencia, t, h);
    if (r.tipo !== 'ok') return { tipo: 'base', motivo: 'Não há processos neste ponto da curva.' };
    const greenwood = curva.greenwood_acumulado;
    const ic = greenwood ? intervaloSentenca(doc.grade_meses, curva.sobrevivencia, greenwood, t, h) : null;
    return { tipo: 'ok', valor: r.valor, ic, temGreenwood: Boolean(greenwood) };
  };

  const mostrar = (e: Escolha) => {
    ultima = e;
    desatualizado = false;
    folha.classList.remove('desatualizado');
    folha.replaceChildren();
    const rotulo = rotuloCurva(doc, e);

    const cabeca = html('div', 'folha-cabeca');
    const citacao = html(
      'p',
      'citacao-resultado',
      `${doc.tribunal} · ${grau(doc)} · tramitando há ${meses(e.t)} sem sentença · dados até ${dataIso(doc.snapshot)}`,
    );
    if (doc.sintetico) citacao.prepend(html('strong', 'marca-sintetico', 'Dado sintético · '));
    cabeca.append(html('h3', '', rotulo), citacao);
    folha.appendChild(cabeca);

    const fechar = (resumo: string) => {
      folha.append(html('p', 'limitacoes', limitacoes(doc)), comoCalculamos(doc));
      status.textContent = resumo;
      const params = new URLSearchParams({ vara: deCodigo(e.vara), classe: deCodigo(e.classe), t: String(e.t) });
      gravarEstado(ABA, params);
    };

    const curva = buscarCurva(doc, e.vara, e.classe);
    if (!curva) {
      folha.appendChild(
        aviso(
          'info',
          'Não há estimativa disponível para esta combinação de vara e classe. Combinações com menos de 30 processos na base não são publicadas.',
          '“Todas as varas” e “Todas as classes” usam um conjunto mais amplo de processos.',
        ),
      );
      fechar(`Não há estimativa disponível para ${rotulo}.`);
      return;
    }

    const corte = mesComBase(doc.grade_meses, curva);
    const st = interpolar(doc.grade_meses, curva.sobrevivencia, e.t)!;
    if (corte === null || e.t > corte || st <= 0) {
      const motivo =
        st <= 0
          ? `Nenhum processo deste recorte chegou a ${meses(e.t)} sem sentença.`
          : `Menos de ${MIN_EM_RISCO} processos deste recorte seguiam sem sentença e em acompanhamento aos ${meses(e.t)}.`;
      folha.appendChild(
        aviso(
          'atencao',
          `${motivo} Não há base para estimar o que acontece a partir daqui, então não mostramos número.`,
          e.vara === null && e.classe === null && corte !== null
            ? `Neste recorte, há base até ${meses(corte)} de tramitação.`
            : 'Um recorte mais amplo, como “Todas as varas” ou “Todas as classes”, pode ter base suficiente.',
        ),
      );
      fechar(`Sem estimativa para ${rotulo} aos ${meses(e.t)}: base insuficiente.`);
      return;
    }

    // Probabilidades: os três horizontes com o mesmo peso, cada um com seu intervalo.
    const lista = document.createElement('dl');
    lista.className = 'probabilidades';
    const resumos: string[] = [];
    for (const h of HORIZONTES) {
      const c = cartaoPara(curva, corte, e.t, h);
      const item = html('div', 'probabilidade');
      item.appendChild(html('dt', '', `Nos próximos ${h} meses`));
      const dd = document.createElement('dd');
      if (c.tipo === 'ok') {
        dd.append(html('span', 'valor', porcentagem(c.valor)), html('span', 'rotulo-valor', 'probabilidade estimada de sentença'));
        dd.appendChild(
          html(
            'span',
            'ic',
            c.ic
              ? `Intervalo de confiança de 95%: de ${porcentagem(c.ic.inferior)} a ${porcentagem(c.ic.superior)}`
              : c.temGreenwood
                ? 'Intervalo de confiança não calculável neste ponto'
                : 'Sem intervalo de confiança publicado para esta curva',
          ),
        );
        resumos.push(`${porcentagem(c.valor)} em ${h} meses`);
      } else {
        dd.append(html('span', 'valor indisponivel', 'Sem estimativa'), html('span', 'ic', c.motivo));
        resumos.push(`sem estimativa em ${h} meses`);
      }
      item.appendChild(dd);
      lista.appendChild(item);
    }
    folha.appendChild(lista);
    folha.appendChild(
      html(
        'p',
        'nota',
        'O intervalo de confiança mostra a incerteza estatística da estimativa. Não é uma garantia para um processo individual.',
      ),
    );

    // Prazos: só dentro do trecho com base.
    const trecho = ate(doc.grade_meses, curva.sobrevivencia, corte);
    const prazo = (p: number) => (trecho.grade.length >= 2 ? quantilCondicional(trecho.grade, trecho.serie, e.t, p) : null);
    const mediana = prazo(0.5);
    const p80 = prazo(0.8);
    const frase = html('div', 'prazos');
    frase.appendChild(html('p', '', `Entre os processos deste recorte que chegaram a ${meses(e.t)} sem sentença:`));
    const itens = document.createElement('ul');
    const naoEstimado = 'não foi possível estimar esse prazo dentro do período observado';
    itens.append(
      html('li', '', mediana === null ? `metade: ${naoEstimado};` : `metade foi sentenciada em até mais ${meses(mediana)};`),
      html('li', '', p80 === null ? `80%: ${naoEstimado}.` : `80% foram sentenciados em até mais ${meses(p80)}.`),
    );
    frase.appendChild(itens);
    folha.appendChild(frase);

    if (!curva.em_risco && st < S_SINAL_INSTAVEL) {
      folha.appendChild(
        aviso(
          'atencao',
          `Só ${porcentagem(st)} dos processos deste recorte chegam a ${meses(e.t)} sem sentença. Isso sinaliza que a estimativa pode ser instável.`,
        ),
      );
    }

    // Gráfico em tempo adicional, com a faixa de confiança da curva condicional.
    const cond = curvaCondicional(trecho.grade, trecho.serie, e.t);
    const alvo = html('div', 'alvo-grafico');
    folha.appendChild(alvo);
    if (cond) {
      const greenwood = curva.greenwood_acumulado;
      let inferior: number[] | undefined;
      let superior: number[] | undefined;
      if (greenwood) {
        inferior = [];
        superior = [];
        cond.meses.forEach((u, i) => {
          const v = cond.valores[i]!;
          const ic = u > 0 ? intervaloSentenca(doc.grade_meses, curva.sobrevivencia, greenwood, e.t, u) : null;
          inferior!.push(ic ? 1 - ic.superior : v);
          superior!.push(ic ? 1 - ic.inferior : v);
        });
      }
      const ultimo = cond.meses[cond.meses.length - 1] ?? 0;
      desenharGrafico(
        alvo,
        [
          {
            rotulo: 'Com base em processos deste recorte',
            cor: 'a',
            meses: cond.meses,
            valores: cond.valores,
            inferior,
            superior,
            marcas: mediana === null ? [] : [{ mes: mediana, valor: 0.5, rotulo: maisMeses(mediana) }],
          },
        ],
        {
          descricao:
            `Proporção dos processos de ${rotulo} que chegaram a ${meses(e.t)} sem sentença e continuam sem sentença ` +
            'em cada mês a partir do tempo informado.',
          rotuloX: 'meses a partir do tempo informado',
          rotuloY: 'ainda sem sentença',
          rotuloMes: maisMeses,
          nota:
            corte < fim
              ? `A curva termina em ${maisMeses(ultimo)}: depois disso, menos de ${MIN_EM_RISCO} processos do recorte seguiam em acompanhamento.`
              : `A curva termina em ${maisMeses(ultimo)}, no fim do período observado.`,
        },
      );
    }

    const emRisco = emRiscoEm(doc.grade_meses, curva, e.t);
    folha.appendChild(
      html(
        'p',
        'amostra-texto',
        `Base: ${inteiro(curva.n)} processos deste recorte, ${inteiro(curva.eventos)} com sentença observada.` +
          (emRisco === null ? '' : ` Aos ${meses(e.t)}, ${inteiro(emRisco)} seguiam sem sentença e em acompanhamento.`),
      ),
    );
    fechar(`Estimativa para ${rotulo}, tramitando há ${meses(e.t)}: ${resumos.join(', ')}.`);
  };

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = validar();
    if (e) mostrar(e);
  });

  for (const c of [vara.controle, classe.controle, tempo.controle, confirmacao.controle]) {
    c.addEventListener('input', marcarDesatualizado);
    c.addEventListener('change', marcarDesatualizado);
  }
  data.controle.addEventListener('change', () => {
    if (!data.controle.value) return data.erro(null);
    const m = mesesAteHoje(data.controle.value);
    if (m === null) return data.erro('A data do ajuizamento não pode estar no futuro.');
    data.erro(null);
    tempo.controle.value = String(m);
    tempo.erro(m > fim ? `Os dados cobrem até ${fim} meses de tramitação. Esta data dá ${meses(m)}.` : null);
    marcarDesatualizado();
  });

  exemplo.addEventListener('click', () => {
    vara.controle.value = TODAS;
    classe.controle.value = TODAS;
    tempo.controle.value = '12';
    data.controle.value = '';
    confirmacao.controle.checked = true;
    for (const c of [vara, classe, tempo, data, confirmacao]) c.erro(null);
    marcarDesatualizado();
    status.textContent = 'Exemplo preenchido: todas as varas, todas as classes, 12 meses. Clique em “Calcular estimativa”.';
  });

  estadoInicial();

  const opcaoExiste = (s: HTMLSelectElement, v: string) => [...s.options].some((o) => o.value === v && v !== NADA);
  return {
    aplicar(params) {
      const v = params.get('vara') ?? '';
      const c = params.get('classe') ?? '';
      const t = params.get('t') ?? '';
      if (!opcaoExiste(vara.controle, v) || !opcaoExiste(classe.controle, c) || !/^\d+$/.test(t) || Number(t) > fim) return;
      vara.controle.value = v;
      classe.controle.value = c;
      tempo.controle.value = t;
      confirmacao.controle.checked = true;
      mostrar({ vara: paraCodigo(v), classe: paraCodigo(c), t: Number(t) });
    },
  };
}
