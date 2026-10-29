// Tela Meu processo: P(sentença nos próximos 3, 6 e 12 meses | tramita há t meses).
import { buscarCurva, rotuloCurva, type Contrato } from './dados';
import { desenharGrafico } from './grafico';
import { inteiro, meses, porcentagem } from './formato';
import {
  curvaCondicional,
  horizonte,
  interpolar,
  probabilidadeSentenca,
  quantilCondicional,
} from './sobrevivencia';
import { AVISO_PASSADO, criarSelect, html, opcoesClasse, opcoesVara, paraCodigo } from './ui';

const HORIZONTES = [3, 6, 12] as const;
/** Abaixo disso, poucos processos chegaram a t sem sentença e a estimativa fica instável. */
const S_POUCOS_CASOS = 0.05;

export function montarMeuProcesso(painel: HTMLElement, doc: Contrato): void {
  const fim = horizonte(doc.grade_meses);

  const intro = html(
    'p',
    'intro',
    'Informe a vara, a classe e há quantos meses o processo tramita desde o ajuizamento. ' +
      'O cálculo usa só os processos que chegaram a esse tempo sem sentença: quanto já passou muda o que falta.',
  );

  const form = html('form', 'controles') as HTMLFormElement;
  form.addEventListener('submit', (ev) => ev.preventDefault());
  const grupo = html('fieldset', 'grupo borda-a') as HTMLFieldSetElement;
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

  const resultado = html('div', 'resultado');
  resultado.setAttribute('aria-live', 'polite');
  const alvoGrafico = html('div', '');
  const aviso = html('p', 'aviso-passado', AVISO_PASSADO);
  painel.append(intro, form, resultado, alvoGrafico, aviso);

  const atualizar = () => {
    resultado.replaceChildren();
    alvoGrafico.replaceChildren();

    const escolha = { vara: paraCodigo(vara.select.value), classe: paraCodigo(classe.select.value) };
    const curva = buscarCurva(doc, escolha.vara, escolha.classe);
    const t = Number(entradaT.value);

    if (entradaT.value.trim() === '' || !Number.isFinite(t) || t < 0) {
      resultado.appendChild(html('p', 'aviso', 'Informe um número de meses igual ou maior que zero.'));
      return;
    }
    if (t > fim) {
      resultado.appendChild(
        html('p', 'aviso', `Os dados cobrem só os primeiros ${fim} meses de tramitação; não há o que dizer depois disso.`),
      );
      return;
    }
    if (!curva) {
      resultado.appendChild(
        html(
          'p',
          'aviso',
          'Não há curva publicada para essa combinação de vara e classe (amostras com menos de 30 processos ficam de fora). ' +
            'Tente "Todas as varas" ou "Todas as classes".',
        ),
      );
      return;
    }

    const titulo = html('h3', '', `${rotuloCurva(doc, escolha)}, tramitando há ${meses(t)}`);
    resultado.appendChild(titulo);

    const st = interpolar(doc.grade_meses, curva.sobrevivencia, t)!;
    if (st <= 0) {
      resultado.appendChild(
        html(
          'p',
          'aviso',
          `Nenhum processo desta amostra chegou a ${meses(t)} sem sentença. ` +
            'Não há base para estimar o que acontece a partir daqui, então não mostramos número.',
        ),
      );
      return;
    }

    const cartoes = html('div', 'probabilidades');
    for (const h of HORIZONTES) {
      const r = probabilidadeSentenca(doc.grade_meses, curva.sobrevivencia, t, h);
      const cartao = html('div', 'probabilidade');
      cartao.appendChild(html('span', 'rotulo', `Nos próximos ${h} meses`));
      if (r.tipo === 'ok') {
        cartao.appendChild(html('strong', 'valor', porcentagem(r.valor)));
        cartao.appendChild(html('span', 'ajuda', 'de chance de sentença'));
      } else if (r.tipo === 'fora-do-horizonte') {
        cartao.appendChild(html('strong', 'valor indisponivel', '—'));
        cartao.appendChild(html('span', 'ajuda', `${t + h} meses passa da janela de ${r.horizonte} meses dos dados`));
      } else {
        cartao.appendChild(html('strong', 'valor indisponivel', '—'));
        cartao.appendChild(html('span', 'ajuda', 'sem processos nesse ponto da curva'));
      }
      cartoes.appendChild(cartao);
    }
    resultado.appendChild(cartoes);

    const mediana = quantilCondicional(doc.grade_meses, curva.sobrevivencia, t, 0.5);
    const p80 = quantilCondicional(doc.grade_meses, curva.sobrevivencia, t, 0.8);
    const frase = html('p', 'frase');
    frase.textContent =
      `Dos processos que chegaram a ${meses(t)} sem sentença, metade foi sentenciada ` +
      (mediana === null ? 'só depois do fim da janela de dados' : `em até mais ${meses(mediana)}`) +
      ' e 80% ' +
      (p80 === null ? 'só depois do fim da janela de dados.' : `em até mais ${meses(p80)}.`);
    resultado.appendChild(frase);

    const base = html('p', 'amostra-texto');
    base.textContent =
      `Base: curva de ${inteiro(curva.n)} processos (${inteiro(curva.eventos)} com sentença, ` +
      `${inteiro(curva.censurados)} abertos no snapshot). Pela curva, ${porcentagem(st)} dos processos chegam a ${meses(t)} sem sentença.`;
    resultado.appendChild(base);

    if (st < S_POUCOS_CASOS) {
      resultado.appendChild(
        html(
          'p',
          'aviso',
          `Atenção: só ${porcentagem(st)} dos processos chegam a esse tempo sem sentença. ` +
            'A estimativa se apoia em poucos casos e pode variar bastante.',
        ),
      );
    }

    resultado.appendChild(
      html(
        'p',
        'nota',
        'Estas probabilidades ainda não têm intervalo de confiança próprio. ' +
          'A incerteza da curva de origem aparece como faixa na aba Explorar.',
      ),
    );

    const cond = curvaCondicional(doc.grade_meses, curva.sobrevivencia, t);
    if (cond) {
      desenharGrafico(
        alvoGrafico,
        [{ rotulo: 'Processos como o seu', cor: 'a', meses: cond.meses, valores: cond.valores }],
        {
          descricao:
            `Proporção de processos que chegaram a ${meses(t)} sem sentença e continuam sem sentença ` +
            `nos meses seguintes, para ${rotuloCurva(doc, escolha)}.`,
          rotuloX: 'meses a partir de hoje',
          rotuloY: 'ainda sem sentença',
        },
      );
    }
  };

  for (const s of [vara.select, classe.select]) s.addEventListener('change', atualizar);
  entradaT.addEventListener('input', atualizar);
  atualizar();
}
