// Tela Meu processo: P(sentença nos próximos 3, 6 e 12 meses | tramita há t meses).
import { buscarCurva, rotuloCurva, type Contrato } from './dados';
import { desenharGrafico } from './grafico';
import { inteiro, meses, porcentagem } from './formato';
import {
  curvaCondicional,
  horizonte,
  interpolar,
  intervaloSentenca,
  probabilidadeSentenca,
  quantilCondicional,
} from './sobrevivencia';
import { AVISO_PASSADO, criarBancada, criarSelect, html, opcoesClasse, opcoesVara, paraCodigo } from './ui';

const HORIZONTES = [3, 6, 12] as const;
/** Abaixo disso, poucos processos chegaram a t sem sentença e a estimativa fica instável. */
const S_POUCOS_CASOS = 0.05;

export function montarMeuProcesso(painel: HTMLElement, doc: Contrato): void {
  const fim = horizonte(doc.grade_meses);
  const { controles, folha } = criarBancada(painel);

  const titulo = html('h2', '', 'Quanto ainda falta no seu processo');
  const intro = html(
    'p',
    'intro',
    'Informe a vara, a classe e há quantos meses o processo tramita desde o ajuizamento. ' +
      'O cálculo usa só os processos que chegaram a esse tempo sem sentença: quanto já passou muda o que falta.',
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());
  const grupo = html('fieldset', 'grupo') as HTMLFieldSetElement;
  grupo.appendChild(html('legend', '', 'Seu processo'));
  const vara = criarSelect('mp-vara', 'Vara', opcoesVara(doc), doc.varas[0]?.codigo ?? null);
  const classe = criarSelect('mp-classe', 'Classe', opcoesClasse(doc), doc.classes[0]?.codigo ?? null);

  const campoT = html('div', 'campo');
  const rotuloT = document.createElement('label');
  rotuloT.htmlFor = 'mp-meses';
  rotuloT.textContent = 'Tramita há (meses)';
  const entradaT = document.createElement('input');
  entradaT.id = 'mp-meses';
  entradaT.type = 'number';
  entradaT.inputMode = 'numeric';
  entradaT.min = '0';
  entradaT.max = String(fim);
  entradaT.step = '1';
  entradaT.value = '12';
  entradaT.setAttribute('aria-describedby', 'mp-meses-ajuda');
  const ajudaT = html('span', 'ajuda', `De 0 a ${fim} meses.`);
  ajudaT.id = 'mp-meses-ajuda';
  campoT.append(rotuloT, entradaT, ajudaT);

  grupo.append(vara.campo, classe.campo, campoT);
  form.appendChild(grupo);

  const aviso = html('p', 'aviso-passado', AVISO_PASSADO);
  controles.append(titulo, intro, form);

  const resultado = html('div', 'folha-resultado');
  resultado.setAttribute('aria-live', 'polite');
  const alvoGrafico = html('div', '');
  const notasFolha = html('div', 'folha-notas');
  folha.append(resultado, alvoGrafico, notasFolha, aviso);

  const mensagem = (texto: string) => {
    resultado.appendChild(html('p', 'aviso', texto));
  };

  const atualizar = () => {
    resultado.replaceChildren();
    alvoGrafico.replaceChildren();
    notasFolha.replaceChildren();

    const escolha = { vara: paraCodigo(vara.select.value), classe: paraCodigo(classe.select.value) };
    const curva = buscarCurva(doc, escolha.vara, escolha.classe);
    const t = Number(entradaT.value);

    const invalido = entradaT.value.trim() === '' || !Number.isFinite(t) || t < 0 || t > fim;
    entradaT.setAttribute('aria-invalid', String(invalido));
    if (entradaT.value.trim() === '' || !Number.isFinite(t) || t < 0) {
      mensagem('Informe um número de meses igual ou maior que zero.');
      return;
    }
    if (t > fim) {
      mensagem(`Os dados cobrem só os primeiros ${fim} meses de tramitação; não há o que dizer depois disso.`);
      return;
    }
    if (!curva) {
      mensagem(
        'Não há curva publicada para essa combinação de vara e classe (amostras com menos de 30 processos ficam de fora). ' +
          'Tente “Todas as varas” ou “Todas as classes”.',
      );
      return;
    }

    const cabeca = html('div', 'folha-cabeca');
    cabeca.append(
      html('h3', '', rotuloCurva(doc, escolha)),
      html('p', '', `Tramitando há ${meses(t)}.`),
    );
    resultado.appendChild(cabeca);

    const st = interpolar(doc.grade_meses, curva.sobrevivencia, t)!;
    if (st <= 0) {
      mensagem(
        `Nenhum processo desta amostra chegou a ${meses(t)} sem sentença. ` +
          'Não há base para estimar o que acontece a partir daqui, então não mostramos número.',
      );
      return;
    }

    const greenwood = curva.greenwood_acumulado;
    const cartoes = document.createElement('dl');
    cartoes.className = 'probabilidades';
    for (const h of HORIZONTES) {
      const r = probabilidadeSentenca(doc.grade_meses, curva.sobrevivencia, t, h);
      const cartao = html('div', 'probabilidade');
      cartao.appendChild(html('dt', '', `Nos próximos ${h} meses`));
      const dd = document.createElement('dd');
      if (r.tipo === 'ok') {
        dd.append(html('span', 'valor', porcentagem(r.valor)), html('span', 'ajuda', 'de chance de sentença'));
        if (greenwood) {
          const ic = intervaloSentenca(doc.grade_meses, curva.sobrevivencia, greenwood, t, h);
          dd.appendChild(
            ic
              ? html('span', 'ic', `IC 95%: ${porcentagem(ic.inferior)} a ${porcentagem(ic.superior)}`)
              : html('span', 'ic', 'IC 95%: não calculável nesse ponto'),
          );
        }
      } else if (r.tipo === 'fora-do-horizonte') {
        dd.append(
          html('span', 'valor indisponivel', '—'),
          html('span', 'ajuda', `${t + h} meses passa da janela de ${r.horizonte} meses dos dados`),
        );
      } else {
        dd.append(html('span', 'valor indisponivel', '—'), html('span', 'ajuda', 'sem processos nesse ponto da curva'));
      }
      cartao.appendChild(dd);
      cartoes.appendChild(cartao);
    }
    resultado.appendChild(cartoes);

    const mediana = quantilCondicional(doc.grade_meses, curva.sobrevivencia, t, 0.5);
    const p80 = quantilCondicional(doc.grade_meses, curva.sobrevivencia, t, 0.8);
    resultado.appendChild(
      html(
        'p',
        'frase',
        `Dos processos que chegaram a ${meses(t)} sem sentença, metade foi sentenciada ` +
          (mediana === null ? 'só depois do fim da janela de dados' : `em até mais ${meses(mediana)}`) +
          ' e 80% ' +
          (p80 === null ? 'só depois do fim da janela de dados.' : `em até mais ${meses(p80)}.`),
      ),
    );

    if (st < S_POUCOS_CASOS) {
      mensagem(
        `Atenção: só ${porcentagem(st)} dos processos chegam a esse tempo sem sentença. ` +
          'A estimativa se apoia em poucos casos e pode variar bastante.',
      );
    }

    const cond = curvaCondicional(doc.grade_meses, curva.sobrevivencia, t);
    if (cond) {
      desenharGrafico(
        alvoGrafico,
        [
          {
            rotulo: 'Processos como o seu',
            cor: 'a',
            meses: cond.meses,
            valores: cond.valores,
            marcas: mediana === null ? [] : [{ mes: mediana, valor: 0.5, rotulo: `+${meses(mediana)}` }],
          },
        ],
        {
          descricao:
            `Proporção de processos que chegaram a ${meses(t)} sem sentença e continuam sem sentença ` +
            `nos meses seguintes, para ${rotuloCurva(doc, escolha)}.`,
          rotuloX: 'meses a partir de hoje',
          rotuloY: 'ainda sem sentença',
        },
      );
    }

    const base = html(
      'p',
      'amostra-texto',
      `Base: curva de ${inteiro(curva.n)} processos (${inteiro(curva.eventos)} com sentença, ` +
        `${inteiro(curva.censurados)} abertos no snapshot). Pela curva, ${porcentagem(st)} dos processos chegam a ${meses(t)} sem sentença.`,
    );
    const nota = html(
      'p',
      'nota',
      greenwood
        ? 'IC 95%: intervalo de confiança pela variância de Greenwood, na mesma escala log(−log) da faixa da aba Explorar. ' +
            'Mede só a incerteza do tamanho da amostra; não cobre mudanças futuras na vara. ' +
            'Quando nenhum ou todos os processos da amostra foram sentenciados no trecho, o intervalo não se define.'
        : 'Estas probabilidades ainda não têm intervalo de confiança próprio. ' +
            'A incerteza da curva de origem aparece como faixa na aba Explorar.',
    );
    notasFolha.append(base, nota);
  };

  for (const s of [vara.select, classe.select]) s.addEventListener('change', atualizar);
  entradaT.addEventListener('input', atualizar);
  atualizar();
}
