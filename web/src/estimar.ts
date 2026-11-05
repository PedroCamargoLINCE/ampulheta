// Tela Estimar tempo: probabilidade estimada de sentença nos próximos 3, 6 e 12 meses
// para um processo que segue sem sentença depois de t meses. O resultado acompanha os
// campos ao vivo: nunca há número de uma seleção anterior na tela (docs/DESIGN.md, seção 4).
import { ORIGEM_PADRAO, buscarCurva, nomeMarco, origensPara, rotuloCurva, type Contrato, type Curva } from './dados';
import { desenharGrafico } from './grafico';
import { dataIso, inteiro, meses, mesesCompletos, porcentagem } from './formato';
import {
  curvaCondicional,
  horizonte,
  interpolar,
  intervaloSentenca,
  probabilidadeSentenca,
  quantilCondicional,
} from './sobrevivencia';
import { ate, emRiscoEm, mesComBase, MIN_EM_RISCO } from './base';
import { ErroConsulta, consultar, erroNumero, formatarNumero, interpretar, normalizarNumero, type Preenchimento } from './consulta';
import {
  NADA,
  TODAS,
  ajudaRecolhida,
  aviso,
  cartaoProbabilidade,
  copiarLink,
  criarBancada,
  criarEntrada,
  criarEscolha,
  criarSelect,
  deCodigo,
  desde,
  gravarEstado,
  grau,
  html,
  limitacoes,
  opcoesClasse,
  opcoesVara,
  paraCodigo,
  paragrafosMetodologia,
} from './ui';

const ABA = 'estimar';
/** Endereço da função da consulta por número (consulta/); sem ele, a busca não aparece. */
const URL_CONSULTA = import.meta.env.VITE_CONSULTA_URL?.trim() ?? '';
/** A API do CNJ leva de 30 s a 1 min; a função espera até 90 s por tentativa. */
const LIMITE_CONSULTA_MS = 100_000;
/** Com o CNJ cheio, o navegador tenta de novo sozinho, espaçado, até este total. */
const LIMITE_TOTAL_MS = 5 * 60_000;
const ESPERA_ENTRE_TENTATIVAS_MS = 20_000;
const HORIZONTES = [3, 6, 12] as const;
/** Só para contratos sem `em_risco`: S(t) baixo é sinal de instabilidade, não contagem de casos. */
const S_SINAL_INSTAVEL = 0.05;

interface Escolha {
  vara: string | null;
  classe: string | null;
  /** Marco de onde se conta o tempo (contrato 1.3.0): ajuizamento ou a fase já atingida. */
  origem: string;
  t: number;
}

type Cartao =
  | { tipo: 'ok'; valor: number; ic: { inferior: number; superior: number } | null }
  | { tipo: 'sem'; motivo: string };

function hojeIso(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

const maisMeses = (m: number) => `+${meses(m)}`;
const mesesRedondos = (m: number) => meses(Math.round(m));

/** Troca o número com uma contagem curta, respeitando quem pede menos movimento. */
function animarPorcentagem(alvo: HTMLElement, de: number | undefined, para: number): void {
  const final = porcentagem(para);
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzir || de === undefined || Math.abs(de - para) < 0.005 || para < 0.01 || de < 0.01) {
    alvo.textContent = final;
    return;
  }
  const inicio = performance.now();
  const duracao = 240;
  const passo = (agora: number) => {
    const k = Math.min(1, (agora - inicio) / duracao);
    const suave = 1 - Math.pow(1 - k, 3);
    alvo.textContent = k < 1 ? `${Math.round((de + (para - de) * suave) * 100)}%` : final;
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

export function montarEstimar(painel: HTMLElement, doc: Contrato): { aplicar: (params: URLSearchParams) => void } {
  const fim = horizonte(doc.grade_meses);
  const { controles, folha } = criarBancada(painel);
  folha.classList.add('folha-estimar');

  controles.append(
    html('h2', '', 'Quanto falta para a sentença?'),
    html(
      'p',
      'intro',
      URL_CONSULTA
        ? 'Busque pelo número do processo ou escolha vara e classe e ajuste há quanto tempo ele está sem sentença.'
        : 'Escolha vara e classe e ajuste há quanto tempo o processo está sem sentença.',
    ),
  );

  // Consulta por número (ADR-016): preenche os campos abaixo com os dados públicos do DataJud.
  const formConsulta = html('form', 'consulta') as HTMLFormElement;
  const numero = criarEntrada(
    'estimar-numero',
    'Número do processo',
    { type: 'text', inputMode: 'numeric', autocomplete: 'off' },
    'Com o número, consultamos o DataJud, a base pública do CNJ, e preenchemos vara, classe, fase e tempo. ' +
      'O número não é guardado nem vai para o link.',
  );
  numero.controle.placeholder = '0000000-00.0000.8.26.0000';
  const buscar = document.createElement('button');
  buscar.type = 'submit';
  buscar.className = 'botao botao-principal';
  buscar.textContent = 'Buscar';
  const linhaNumero = html('div', 'consulta-linha');
  numero.controle.replaceWith(linhaNumero);
  linhaNumero.append(numero.controle, buscar);
  const retornoConsulta = html('div', 'consulta-retorno');
  retornoConsulta.setAttribute('aria-live', 'polite');
  formConsulta.append(
    numero.campo,
    html(
      'p',
      'consulta-aviso',
      'A base pública do CNJ é lenta: a busca leva de 1 a 2 minutos e, quando os servidores estão cheios, alguns minutos a mais. ' +
        'Dá para preencher à mão enquanto isso.',
    ),
    retornoConsulta,
  );
  if (URL_CONSULTA) controles.append(formConsulta, html('p', 'separador', 'ou preencha à mão'));

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());

  const vara = criarSelect(
    'estimar-vara',
    'Vara',
    opcoesVara(doc, 'Escolha a vara'),
    NADA,
    `Aparece na capa do processo e na consulta processual do ${doc.tribunal}. “Todas as varas” junta as ${doc.varas.length} varas da base.`,
  );
  const classe = criarSelect(
    'estimar-classe',
    'Classe',
    opcoesClasse(doc, 'Escolha a classe'),
    NADA,
    'O tipo de ação, como “Procedimento Comum Cível” ou um despejo. Aparece na capa do processo e na consulta processual.',
  );

  // Fase (contrato 1.3.0): quem já passou por um marco usa a curva que começa nele.
  const origens = origensPara(doc);
  const outras = origens.filter((o) => o !== ORIGEM_PADRAO);
  const fase =
    outras.length > 0
      ? criarEscolha(
          'estimar-fase',
          'Em que fase está?',
          origens.map((o) => ({
            valor: o,
            texto:
              o === ORIGEM_PADRAO
                ? outras.length === 1
                  ? `Ainda não teve ${nomeMarco(doc, outras[0]!).toLowerCase()} (ou não sei)`
                  : 'Nenhuma das outras (ou não sei)'
                : `Já teve ${nomeMarco(doc, o).toLowerCase()}`,
          })),
          ORIGEM_PADRAO,
          'Se o processo já teve audiência, a estimativa usa só processos que também tiveram e conta o tempo a partir dela. ' +
            'Se não sabe, a estimativa desde o ajuizamento continua valendo.',
        )
      : null;
  const origemAtual = () => fase?.valor() ?? ORIGEM_PADRAO;

  /** Textos que dependem de onde se conta o tempo. */
  const textos = (o: string) => {
    const d = desde(doc, o);
    const daData = d.replace(/^desde (o|a) /, (_, art: string) => (art === 'o' ? 'do ' : 'da '));
    return o === ORIGEM_PADRAO
      ? {
          rotulo: 'Há quanto tempo tramita sem sentença',
          ajuda: `Meses completos desde o ajuizamento, de 0 a ${fim}. A estimativa vale para processos que ainda não tiveram sentença de 1º grau.`,
          slider: 'Meses sem sentença',
          data: 'Sei a data do ajuizamento',
          dataRotulo: 'Data do ajuizamento',
          falta: 'o tempo sem sentença',
          tempo: (t: number) => meses(t),
          situacao: (t: number) => `há ${meses(t)} sem sentença`,
        }
      : {
          rotulo: `Tempo ${d}`,
          ajuda: `Meses completos ${d} até hoje, de 0 a ${fim}. A estimativa vale para processos que ainda não tiveram sentença de 1º grau.`,
          slider: `Meses ${d}`,
          data: daData === d ? `Sei a data (${nomeMarco(doc, o).toLowerCase()})` : `Sei a data ${daData}`,
          dataRotulo: `Data ${daData === d ? `(${nomeMarco(doc, o).toLowerCase()})` : daData}`,
          falta: `o tempo ${d}`,
          tempo: (t: number) => `${meses(t)} ${d}`,
          situacao: (t: number) => `${meses(t)} ${d}, sem sentença`,
        };
  };

  // Tempo: controle deslizante e campo numérico, sempre iguais. Começa vazio: nada de 12 meses inventado.
  const tempo = criarEntrada(
    'estimar-meses',
    'Há quanto tempo tramita sem sentença',
    { type: 'text', inputMode: 'numeric', autocomplete: 'off' },
    `Meses completos desde o ajuizamento, de 0 a ${fim}. A estimativa vale para processos que ainda não tiveram sentença de 1º grau.`,
  );
  tempo.controle.classList.add('campo-meses');
  tempo.controle.placeholder = 'meses';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(fim);
  slider.step = '1';
  slider.value = '0';
  slider.className = 'slider';
  slider.dataset.vazio = '';
  slider.setAttribute('aria-label', 'Meses sem sentença');
  slider.setAttribute('aria-valuetext', 'não informado');
  const linhaTempo = html('div', 'tempo-linha');
  tempo.controle.replaceWith(linhaTempo);
  linhaTempo.append(slider, tempo.controle);

  // A data do ajuizamento fica a um clique, para quem não sabe contar os meses.
  const abrirData = document.createElement('button');
  abrirData.type = 'button';
  abrirData.className = 'link-botao';
  abrirData.textContent = 'Sei a data do ajuizamento';
  abrirData.setAttribute('aria-expanded', 'false');
  const data = criarEntrada('estimar-data', 'Data do ajuizamento', { type: 'date', max: hojeIso() });
  data.campo.hidden = true;
  abrirData.addEventListener('click', () => {
    data.campo.hidden = !data.campo.hidden;
    abrirData.setAttribute('aria-expanded', String(!data.campo.hidden));
    if (!data.campo.hidden) data.controle.focus();
  });

  const exemplo = document.createElement('button');
  exemplo.type = 'button';
  exemplo.className = 'link-botao';
  exemplo.textContent = 'Ver um exemplo';
  const atalhos = html('div', 'atalhos');
  atalhos.append(abrirData, exemplo);

  // No celular o resultado fica abaixo do formulário: este resumo mostra os números enquanto a pessoa mexe.
  const resumoVivo = html('p', 'resumo-vivo');
  resumoVivo.setAttribute('aria-hidden', 'true');
  resumoVivo.hidden = true;

  form.append(vara.campo, classe.campo, ...(fase ? [fase.campo] : []), tempo.campo, resumoVivo, data.campo, atalhos);

  /** Ao trocar de fase, os textos do tempo acompanham. */
  const aplicarTextosFase = () => {
    const tx = textos(origemAtual());
    tempo.campo.querySelector('label')!.textContent = tx.rotulo;
    const ajuda = tempo.campo.querySelector('.ajuda');
    if (ajuda) ajuda.textContent = tx.ajuda;
    tempo.campo.querySelector('.ajuda-botao')?.setAttribute('aria-label', `O que é ${tx.rotulo.toLowerCase()}?`);
    slider.setAttribute('aria-label', tx.slider);
    abrirData.textContent = tx.data;
    data.campo.querySelector('label')!.textContent = tx.dataRotulo;
  };
  controles.appendChild(form);

  // Anúncio curto e espaçado: quem usa leitor de tela ouve o resultado quando para de mexer.
  const status = html('p', 'visually-hidden');
  status.setAttribute('role', 'status');
  painel.appendChild(status);
  let anuncio: number | undefined;
  const anunciar = (texto: string, ja = false) => {
    window.clearTimeout(anuncio);
    if (ja) status.textContent = texto;
    else anuncio = window.setTimeout(() => (status.textContent = texto), 700);
  };

  let anteriores = new Map<number, number>();
  let detalhesAberto = false;
  let avisoLink: HTMLElement | null = null;
  /** Durante a montagem o link ainda não foi lido (main.ts); não se mexe nele. */
  let montada = false;

  const vazio = (texto: string) => {
    const caixa = html('div', 'vazio');
    const fantasmas = html('div', 'probabilidades fantasmas');
    fantasmas.setAttribute('aria-hidden', 'true');
    for (const h of HORIZONTES) {
      const f = html('div', 'probabilidade');
      f.append(html('span', 'fantasma-rotulo', `em ${h} meses`), html('span', 'fantasma-valor', ''));
      fantasmas.appendChild(f);
    }
    caixa.append(html('p', 'vazio-texto', texto), fantasmas);
    folha.replaceChildren(...(avisoLink ? [avisoLink] : []), caixa);
    anteriores = new Map();
    resumoVivo.hidden = true;
    // Sem resultado na tela, o link não pode carregar o recorte de antes.
    if (montada && !avisoLink) gravarEstado(ABA, null);
  };

  const cartaoPara = (curva: Curva, corte: number, t: number, h: number): Cartao => {
    if (t + h > fim) return { tipo: 'sem', motivo: 'além do período dos dados' };
    if (t + h > corte) return { tipo: 'sem', motivo: 'poucos processos acompanhados' };
    const r = probabilidadeSentenca(doc.grade_meses, curva.sobrevivencia, t, h);
    if (r.tipo !== 'ok') return { tipo: 'sem', motivo: 'poucos processos acompanhados' };
    const gw = curva.greenwood_acumulado;
    return { tipo: 'ok', valor: r.valor, ic: gw ? intervaloSentenca(doc.grade_meses, curva.sobrevivencia, gw, t, h) : null };
  };

  /** Um clique para o recorte mais amplo que tenha curva e base no tempo informado. */
  const acaoAmpliar = (e: Escolha): HTMLButtonElement | undefined => {
    const candidatos: [Partial<Escolha>, string][] = [
      [{ vara: null }, 'Ver com todas as varas'],
      [{ classe: null }, 'Ver com todas as classes'],
      [{ vara: null, classe: null }, 'Ver com todas as varas e classes'],
    ];
    const achado = candidatos
      .map(([mudanca, texto]) => [{ ...e, ...mudanca }, texto] as const)
      .find(([alvo]) => {
        if (alvo.vara === e.vara && alvo.classe === e.classe) return false;
        const c = buscarCurva(doc, alvo.vara, alvo.classe, alvo.origem);
        const corte = c ? mesComBase(doc.grade_meses, c) : null;
        return corte !== null && alvo.t <= corte;
      });
    if (!achado) return undefined;
    const [alvo, texto] = achado;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'botao botao-secundario';
    b.textContent = texto;
    b.addEventListener('click', () => {
      vara.controle.value = deCodigo(alvo.vara);
      classe.controle.value = deCodigo(alvo.classe);
      atualizar();
    });
    return b;
  };

  const mostrar = (e: Escolha) => {
    const rotulo = rotuloCurva(doc, e);
    const tx = textos(e.origem);
    const params = new URLSearchParams({ vara: deCodigo(e.vara), classe: deCodigo(e.classe), t: String(e.t) });
    if (e.origem !== ORIGEM_PADRAO) params.set('fase', e.origem);
    gravarEstado(ABA, params);

    const cabeca = html('div', 'folha-cabeca');
    const linhaCitacao = html('div', 'citacao-linha');
    const citacao = html(
      'p',
      'citacao-resultado',
      `${doc.tribunal} · ${grau(doc)} · ${tx.situacao(e.t)} · dados até ${dataIso(doc.snapshot)}`,
    );
    if (doc.sintetico) citacao.prepend(html('strong', 'marca-sintetico', 'Dado sintético · '));
    linhaCitacao.append(citacao, copiarLink((t) => anunciar(t, true)));
    cabeca.append(html('h3', '', rotulo), linhaCitacao, html('p', 'url-impressa', `Link deste resultado: ${location.href}`));
    const partes: Node[] = [cabeca];

    const curva = buscarCurva(doc, e.vara, e.classe, e.origem);
    const corte = curva ? mesComBase(doc.grade_meses, curva) : null;
    const st = curva ? interpolar(doc.grade_meses, curva.sobrevivencia, e.t)! : 0;

    if (!curva || corte === null || e.t > corte || st <= 0) {
      const texto = !curva
        ? e.origem === ORIGEM_PADRAO
          ? 'Não há estimativa para esta combinação: ela tem menos de 30 processos na base.'
          : `Não há estimativa ${desde(doc, e.origem)} para esta combinação: menos de 30 processos dela têm ${nomeMarco(doc, e.origem).toLowerCase()} registrada.`
        : `Poucos processos deste recorte chegaram a ${tx.tempo(e.t)} sem sentença para estimar a partir daqui.`;
      const passo =
        curva && e.vara === null && e.classe === null && corte !== null ? `Neste recorte, há base até ${meses(corte)}.` : undefined;
      partes.push(aviso('atencao', texto, passo, acaoAmpliar(e)));
      folha.replaceChildren(...partes);
      anteriores = new Map();
      resumoVivo.textContent = 'Sem estimativa para este recorte. Veja abaixo.';
      resumoVivo.hidden = false;
      anunciar(`Sem estimativa para ${rotulo} com ${tx.tempo(e.t)}.`);
      return;
    }

    // Três números com o mesmo peso; o intervalo em letra menor, explicado uma vez só.
    const titulo = html('div', 'probabilidades-titulo');
    const ajudaIc = ajudaRecolhida(
      'estimar-ajuda-ic',
      'o intervalo',
      'O intervalo (“entre 8% e 10%”) é o intervalo de confiança de 95%: a incerteza estatística da estimativa. ' +
        'Não é garantia para um processo individual.',
    );
    titulo.append(html('span', '', 'Probabilidade estimada de sentença'), ajudaIc.botao);
    const lista = document.createElement('dl');
    lista.className = 'probabilidades';
    const resumos: string[] = [];
    const novos = new Map<number, number>();
    for (const h of HORIZONTES) {
      const c = cartaoPara(curva, corte, e.t, h);
      if (c.tipo === 'ok') {
        const intervalo = c.ic ? `entre ${porcentagem(c.ic.inferior)} e ${porcentagem(c.ic.superior)}` : null;
        const cartao = cartaoProbabilidade(h, { tipo: 'ok', valor: porcentagem(c.valor), intervalo });
        animarPorcentagem(cartao.querySelector('.valor')!, anteriores.get(h), c.valor);
        novos.set(h, c.valor);
        lista.appendChild(cartao);
        resumos.push(`${porcentagem(c.valor)} em ${h} meses`);
      } else {
        lista.appendChild(cartaoProbabilidade(h, { tipo: 'sem-estimativa', motivo: c.motivo }));
        resumos.push(`sem estimativa em ${h} meses`);
      }
    }
    anteriores = novos;
    partes.push(titulo, ajudaIc.painel, lista);
    resumoVivo.replaceChildren(
      ...HORIZONTES.flatMap((h, i) => {
        const v = novos.get(h);
        return [
          ...(i ? [' · '] : []),
          html('strong', '', v === undefined ? 'sem base' : porcentagem(v)),
          ` em ${h} meses`,
        ];
      }),
    );
    resumoVivo.hidden = false;

    // Uma frase de prazo, só dentro do trecho com base.
    const trecho = ate(doc.grade_meses, curva.sobrevivencia, corte);
    const prazo = (p: number) => (trecho.grade.length >= 2 ? quantilCondicional(trecho.grade, trecho.serie, e.t, p) : null);
    const mediana = prazo(0.5);
    const p80 = prazo(0.8);
    partes.push(
      html(
        'p',
        'frase-resumo',
        mediana === null
          ? 'Não foi possível estimar, dentro do período observado, em quanto tempo metade dos processos assim teve sentença.'
          : `Metade dos processos assim teve sentença em até mais ${mesesRedondos(mediana)}.`,
      ),
    );
    if (!curva.em_risco && st < S_SINAL_INSTAVEL) {
      partes.push(aviso('atencao', 'Poucos processos deste recorte chegam a esse tempo sem sentença: a estimativa pode ser instável.'));
    }

    const alvo = html('div', 'alvo-grafico');
    partes.push(alvo, html('p', 'limitacoes', limitacoes(doc)));

    // Detalhes: tudo que é útil, mas não essencial para ler o resultado.
    const detalhes = document.createElement('details');
    detalhes.className = 'detalhes';
    detalhes.open = detalhesAberto;
    detalhes.addEventListener('toggle', () => (detalhesAberto = detalhes.open));
    detalhes.appendChild(html('summary', '', 'Detalhes e metodologia'));
    const corpo = html('div', 'detalhes-corpo');
    const emRisco = emRiscoEm(doc.grade_meses, curva, e.t);
    corpo.append(
      html(
        'p',
        '',
        `Base: ${inteiro(curva.n)} processos deste recorte, ${inteiro(curva.eventos)} com sentença observada.` +
          (emRisco === null ? '' : ` Com ${tx.tempo(e.t)}, ${inteiro(emRisco)} seguiam sem sentença e em acompanhamento.`),
      ),
      html(
        'p',
        '',
        p80 === null
          ? 'O prazo em que 80% tiveram sentença não pôde ser estimado dentro do período observado.'
          : `80% dos processos assim tiveram sentença em até mais ${mesesRedondos(p80)}.`,
      ),
    );
    if (corte < fim) {
      corpo.appendChild(
        html('p', '', `A curva termina em ${maisMeses(corte - e.t)}: depois disso, menos de ${MIN_EM_RISCO} processos seguiam em acompanhamento.`),
      );
    }
    corpo.appendChild(html('h4', '', 'Como calculamos'));
    for (const t of paragrafosMetodologia(doc)) corpo.appendChild(html('p', '', t));
    detalhes.appendChild(corpo);
    partes.push(detalhes);

    folha.replaceChildren(...partes);

    // Gráfico em tempo adicional, com a faixa de confiança da curva condicional.
    const cond = curvaCondicional(trecho.grade, trecho.serie, e.t);
    if (cond) {
      const gw = curva.greenwood_acumulado;
      let inferior: number[] | undefined;
      let superior: number[] | undefined;
      if (gw) {
        inferior = [];
        superior = [];
        cond.meses.forEach((u, i) => {
          const v = cond.valores[i]!;
          const ic = u > 0 ? intervaloSentenca(doc.grade_meses, curva.sobrevivencia, gw, e.t, u) : null;
          inferior!.push(ic ? 1 - ic.superior : v);
          superior!.push(ic ? 1 - ic.inferior : v);
        });
      }
      desenharGrafico(
        alvo,
        [
          {
            rotulo: 'Processos deste recorte',
            cor: 'a',
            meses: cond.meses,
            valores: cond.valores,
            inferior,
            superior,
            marcas: mediana === null ? [] : [{ mes: mediana, valor: 0.5, rotulo: maisMeses(Math.round(mediana)) }],
          },
        ],
        {
          descricao:
            `Proporção dos processos de ${rotulo} que chegaram a ${tx.tempo(e.t)} sem sentença e continuam sem sentença ` +
            'em cada mês a partir de agora.',
          rotuloX: 'meses a partir de agora',
          rotuloY: 'ainda sem sentença',
          rotuloMes: maisMeses,
          compacto: true,
        },
      );
    }
    anunciar(`${rotulo}, ${tx.situacao(e.t)}: ${resumos.join(', ')}.`);
  };

  /** Lê os campos; o resultado só aparece com vara, classe e tempo informados. */
  const atualizar = () => {
    const v = vara.controle.value;
    const c = classe.controle.value;
    const bruto = tempo.controle.value.trim();
    let t: number | null = null;
    if (bruto === '') tempo.erro(null);
    else if (!/^\d+$/.test(bruto)) tempo.erro('Use um número inteiro de meses, como 18.');
    else if (Number(bruto) > fim) tempo.erro(`Os dados cobrem até ${fim} meses.`);
    else {
      tempo.erro(null);
      t = Number(bruto);
    }

    if (v === NADA || c === NADA || t === null) {
      const falta = [v === NADA && 'a vara', c === NADA && 'a classe', bruto === '' && textos(origemAtual()).falta].filter(Boolean);
      vazio(
        falta.length
          ? `Escolha ${falta.join(', ').replace(/, ([^,]*)$/, ' e $1')} para ver a estimativa.`
          : 'Corrija o tempo para ver a estimativa.',
      );
      return;
    }
    mostrar({ vara: paraCodigo(v), classe: paraCodigo(c), origem: origemAtual(), t });
  };

  /** Toda mudança feita pela pessoa tira o aviso de link inválido e recalcula. */
  const pelaPessoa = (f: () => void) => () => {
    if (consultaAtual) mexeuDurante = true;
    avisoLink = null;
    f();
    atualizar();
  };

  const definirTempo = (m: number | null) => {
    if (m === null) {
      tempo.controle.value = '';
      slider.value = '0';
      slider.dataset.vazio = '';
      slider.setAttribute('aria-valuetext', 'não informado');
      return;
    }
    tempo.controle.value = String(m);
    slider.value = String(Math.min(m, fim));
    delete slider.dataset.vazio;
    slider.setAttribute('aria-valuetext', meses(m));
  };

  slider.addEventListener('input', pelaPessoa(() => definirTempo(Number(slider.value))));
  tempo.controle.addEventListener(
    'input',
    pelaPessoa(() => {
      const bruto = tempo.controle.value.trim();
      if (/^\d+$/.test(bruto) && Number(bruto) <= fim) {
        slider.value = bruto;
        delete slider.dataset.vazio;
        slider.setAttribute('aria-valuetext', meses(Number(bruto)));
      } else if (bruto === '') {
        slider.dataset.vazio = '';
        slider.setAttribute('aria-valuetext', 'não informado');
      }
    }),
  );
  for (const s of [vara.controle, classe.controle]) s.addEventListener('change', pelaPessoa(() => {}));
  // O tempo informado muda de sentido com a fase: zera em vez de reinterpretar o número.
  fase?.aoMudar(
    pelaPessoa(() => {
      definirTempo(null);
      data.controle.value = '';
      data.erro(null);
      aplicarTextosFase();
    }),
  );
  data.controle.addEventListener(
    'change',
    pelaPessoa(() => {
      if (!data.controle.value) return data.erro(null);
      const m = mesesCompletos(data.controle.value);
      if (m === null) return data.erro('A data não pode estar no futuro.');
      data.erro(null);
      definirTempo(m);
    }),
  );
  exemplo.addEventListener(
    'click',
    pelaPessoa(() => {
      vara.controle.value = TODAS;
      classe.controle.value = TODAS;
      fase?.definir(ORIGEM_PADRAO);
      aplicarTextosFase();
      definirTempo(12);
    }),
  );

  // Consulta: a base do CNJ é lenta e às vezes está cheia. A tela diz isso antes, mostra o
  // tempo, tenta de novo sozinha por alguns minutos e não atropela quem preencheu à mão.
  let consultaAtual: AbortController | null = null;
  let mexeuDurante = false;
  const mostrarRetorno = (...nos: Node[]) => retornoConsulta.replaceChildren(...nos);
  const aplicarConsulta = (p: Preenchimento) => {
    avisoLink = null;
    vara.controle.value = p.vara ?? NADA;
    classe.controle.value = p.classe ?? NADA;
    fase?.definir(p.origem ?? ORIGEM_PADRAO);
    aplicarTextosFase();
    definirTempo(p.sentenca ? null : (p.t ?? null));
    data.controle.value = '';
    for (const c of [vara, classe, tempo, data]) c.erro(null);
    atualizar();
  };
  const mostrarAchado = (p: Preenchimento, n: string, perguntar: boolean) => {
    const caixa = html('div', 'consulta-fatos');
    caixa.append(html('p', '', `${formatarNumero(n)}: ${p.fatos}`));
    if (p.avisos.length) {
      const lista = document.createElement('ul');
      for (const a of p.avisos) lista.appendChild(html('li', '', a));
      caixa.appendChild(lista);
    }
    if (perguntar) {
      // A pessoa preencheu à mão enquanto esperava: o achado vira sugestão, não sobrescreve.
      const usar = document.createElement('button');
      usar.type = 'button';
      usar.className = 'botao botao-secundario';
      usar.textContent = 'Usar estes dados';
      const nota = html('p', 'consulta-espera', 'Você mexeu nos campos durante a busca, então não trocamos nada.');
      usar.addEventListener('click', () => {
        aplicarConsulta(p);
        nota.remove();
        usar.remove();
      });
      caixa.append(nota, usar);
    }
    mostrarRetorno(caixa);
  };
  const relogio = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const esperar = (ms: number, sinal: AbortSignal) =>
    new Promise<void>((ok, falha) => {
      const id = window.setTimeout(ok, ms);
      sinal.addEventListener('abort', () => (window.clearTimeout(id), falha(new DOMException('cancelada', 'AbortError'))), { once: true });
    });

  const executarConsulta = async () => {
    const erro = erroNumero(numero.controle.value);
    numero.erro(erro);
    if (erro) {
      numero.controle.focus();
      return;
    }
    const n = normalizarNumero(numero.controle.value)!;
    consultaAtual?.abort();
    const controle = new AbortController();
    consultaAtual = controle;
    mexeuDurante = false;
    const inicio = Date.now();

    const linha = html('p', 'consulta-espera');
    const detalhe = html('p', 'consulta-espera');
    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'link-botao';
    cancelar.textContent = 'Cancelar busca';
    cancelar.addEventListener('click', () => controle.abort());
    let texto = 'Consultando a base pública do CNJ. Costuma levar de 1 a 2 minutos.';
    let proxima = 0;
    const pintar = () => {
      linha.textContent = `${texto} (${relogio(Date.now() - inicio)})`;
      detalhe.textContent = proxima > Date.now() ? `Nova tentativa em ${Math.ceil((proxima - Date.now()) / 1000)} s.` : '';
      detalhe.hidden = !detalhe.textContent;
    };
    pintar();
    const tique = window.setInterval(pintar, 1000);
    mostrarRetorno(linha, detalhe, cancelar);
    buscar.disabled = true;
    buscar.textContent = 'Buscando…';

    let tentativa = 0;
    try {
      for (;;) {
        tentativa += 1;
        const rodada = new AbortController();
        const repassar = () => rodada.abort();
        controle.signal.addEventListener('abort', repassar, { once: true });
        const limite = window.setTimeout(() => rodada.abort(), LIMITE_CONSULTA_MS);
        try {
          const r = await consultar(URL_CONSULTA, n, rodada.signal);
          const p = interpretar(doc, r);
          if (!mexeuDurante) aplicarConsulta(p);
          mostrarAchado(p, n, mexeuDurante);
          return;
        } catch (e) {
          if (controle.signal.aborted) throw e;
          const ocupado = rodada.signal.aborted || (e instanceof ErroConsulta && e.tentarDeNovo);
          if (!ocupado) {
            mostrarRetorno(aviso('atencao', e instanceof ErroConsulta ? e.message : 'A busca falhou.', 'Você pode preencher os campos à mão.'));
            return;
          }
          if (Date.now() - inicio + ESPERA_ENTRE_TENTATIVAS_MS >= LIMITE_TOTAL_MS) {
            mostrarRetorno(
              aviso(
                'atencao',
                `Os servidores públicos do CNJ continuam cheios (${tentativa} tentativas em ${relogio(Date.now() - inicio)}).`,
                'Tente de novo mais tarde ou preencha os campos à mão.',
              ),
            );
            return;
          }
          texto = `Os servidores públicos do CNJ estão cheios. Vamos tentar de novo sozinhos por até ${LIMITE_TOTAL_MS / 60000} minutos; pode preencher à mão enquanto isso.`;
          proxima = Date.now() + ESPERA_ENTRE_TENTATIVAS_MS;
          pintar();
          await esperar(ESPERA_ENTRE_TENTATIVAS_MS, controle.signal);
          proxima = 0;
          texto = `Tentativa ${tentativa + 1}: consultando a base pública do CNJ de novo.`;
          pintar();
        } finally {
          window.clearTimeout(limite);
          controle.signal.removeEventListener('abort', repassar);
        }
      }
    } catch {
      mostrarRetorno(html('p', 'consulta-espera', 'Busca cancelada.'));
    } finally {
      window.clearInterval(tique);
      if (consultaAtual === controle) consultaAtual = null;
      buscar.disabled = false;
      buscar.textContent = 'Buscar';
    }
  };
  formConsulta.addEventListener('submit', (ev) => {
    ev.preventDefault();
    void executarConsulta();
  });
  numero.controle.addEventListener('input', () => numero.erro(null));

  atualizar();
  montada = true;

  const opcaoExiste = (s: HTMLSelectElement, v: string) => [...s.options].some((o) => o.value === v && v !== NADA);
  return {
    aplicar(params) {
      const v = params.get('vara') ?? '';
      const c = params.get('classe') ?? '';
      const t = params.get('t') ?? '';
      const f = params.get('fase') ?? ORIGEM_PADRAO;
      if (!origens.includes(f) || !opcaoExiste(vara.controle, v) || !opcaoExiste(classe.controle, c) || !/^\d+$/.test(t) || Number(t) > fim) {
        avisoLink = aviso('info', `Este link tem um recorte que não existe nos dados de ${dataIso(doc.snapshot)}. Escolha os filtros ao lado.`);
        atualizar();
        return;
      }
      vara.controle.value = v;
      classe.controle.value = c;
      fase?.definir(f);
      aplicarTextosFase();
      definirTempo(Number(t));
      atualizar();
    },
  };
}
