// Página interna de componentes (docs/DESIGN.md, seção 11.5): cada componente nos estados
// normal, foco, erro, indisponível e carregamento. Só existe no `npm run dev`
// (/componentes.html); o build publica apenas o index.html. Os números são ilustrativos.
import type { Contrato } from './dados';
import { desenharGrafico } from './grafico';
import {
  aviso,
  botao,
  cartaoProbabilidade,
  comoCalculamos,
  criarEntrada,
  criarSelect,
  html,
} from './ui';

const ILUSTRATIVO: Contrato = {
  contrato: '1.2.0',
  gerado_em: '2026-01-01T00:00:00Z',
  snapshot: '2026-01-01',
  sintetico: true,
  fonte: { nome: 'Fonte ilustrativa', url: '#', citacao: 'Exemplo.' },
  tribunal: 'TJXX',
  grau: 'G1',
  evento: 'Evento ilustrativo',
  grade_meses: [0, 1],
  varas: [{ codigo: '1', nome: 'Vara Ilustrativa', municipio: 'Cidade' }],
  classes: [{ codigo: '1', nome: 'Classe Ilustrativa' }],
  curvas: [],
};

const raiz = document.getElementById('conteudo')!;

function secao(titulo: string, descricao: string, ...exemplos: [string, Node][]): void {
  const s = html('section', 'catalogo-secao');
  s.append(html('h2', '', titulo), html('p', 'nota', descricao));
  const grade = html('div', 'catalogo-grade');
  for (const [rotulo, no] of exemplos) {
    const caixa = html('div', 'catalogo-exemplo');
    caixa.append(html('p', 'catalogo-rotulo', rotulo), no);
    grade.appendChild(caixa);
  }
  s.appendChild(grade);
  raiz.appendChild(s);
}

function emFolha(...nos: Node[]): HTMLElement {
  const f = html('div', 'folha');
  f.append(...nos);
  return f;
}

raiz.appendChild(html('h1', 'marca', 'Componentes'));

// Campo
const opcoes = [
  { valor: '', texto: 'Escolha a vara' },
  { valor: 'todas', texto: 'Todas as varas (9 varas da base)' },
];
const normal = criarSelect('c-normal', 'Vara', opcoes, '', 'Aparece na capa do processo.');
const foco = criarEntrada('c-foco', 'Tempo desde o ajuizamento, em meses', { type: 'text', inputMode: 'numeric' }, 'De 0 a 106.');
foco.controle.classList.add('demo-foco');
foco.controle.value = '12';
const erro = criarEntrada('c-erro', 'Tempo desde o ajuizamento, em meses', { type: 'text', inputMode: 'numeric' }, 'De 0 a 106.');
erro.controle.value = '12,5';
erro.erro('Informe um número inteiro de meses, sem vírgula. Por exemplo: 18.');
const desabilitado = criarSelect('c-desab', 'Classe processual', [{ valor: '', texto: 'Escolha a classe' }], '');
desabilitado.controle.disabled = true;
secao(
  'Campo',
  'Rótulo permanente, ajuda atrás de “?”, valor, erro textual e estado desabilitado.',
  ['Normal', normal.campo],
  ['Foco', foco.campo],
  ['Erro', erro.campo],
  ['Desabilitado', desabilitado.campo],
);

// Botão
const focoBotao = botao('Calcular estimativa', 'principal');
focoBotao.classList.add('demo-foco');
const desabBotao = botao('Calcular estimativa', 'principal');
desabBotao.disabled = true;
secao(
  'Botão',
  'Verbo claro; uma ação principal por etapa; foco visível.',
  ['Principal', botao('Calcular estimativa', 'principal')],
  ['Principal com foco', focoBotao],
  ['Principal desabilitado', desabBotao],
  ['Secundário', botao('Preencher um exemplo', 'secundario')],
);

// Aviso
secao(
  'Aviso',
  'Motivo, impacto e próximo passo; o tipo aparece em texto, não só na cor.',
  ['Informação', aviso('info', 'Não há estimativa disponível para esta combinação.', 'Revise a vara ou a classe.')],
  ['Atenção', aviso('atencao', 'Menos de 10 processos seguiam em acompanhamento.', 'Um recorte mais amplo pode ter base suficiente.')],
  ['Erro', aviso('erro', 'Os dados não carregaram.', 'Tente de novo.')],
);

// Resumo de estimativa
const lista = (...itens: HTMLElement[]) => {
  const dl = document.createElement('dl');
  dl.className = 'probabilidades';
  dl.append(...itens);
  return dl;
};
secao(
  'Resumo de estimativa',
  'Horizonte, probabilidade, intervalo disponível e contexto. Sem número quando não há base.',
  [
    'Normal e indisponível',
    emFolha(
      lista(
        cartaoProbabilidade(3, { tipo: 'ok', valor: '10%', intervalo: 'entre 8% e 12%' }),
        cartaoProbabilidade(6, { tipo: 'ok', valor: '<1%', intervalo: null }),
        cartaoProbabilidade(12, { tipo: 'sem-estimativa', motivo: 'poucos processos acompanhados' }),
      ),
    ),
  ],
);

// Estados de carregamento e vazio
const carregando = html('p', 'nota', 'Carregando dados…');
carregando.setAttribute('role', 'status');
const vazio = html('div', 'vazio');
vazio.append(html('h3', '', 'O resultado aparece aqui'), html('p', '', 'Nenhum número aparece antes do cálculo.'));
secao('Estados da folha', 'Carregando e inicial, sem resultado fictício.', ['Carregando', emFolha(carregando)], ['Inicial', emFolha(vazio)]);

// Gráfico e tabela
const alvo = html('div', 'alvo-grafico');
const meses = Array.from({ length: 25 }, (_, i) => i);
const valores = meses.map((m) => Math.exp(-m / 10));
secao('Gráfico', 'Título, unidades, legenda, leitura por teclado e tabela equivalente.', ['Duas séries ilustrativas', emFolha(alvo)]);
desenharGrafico(
  alvo,
  [
    {
      rotulo: 'Série ilustrativa A',
      cor: 'a',
      meses,
      valores,
      inferior: valores.map((v) => v * 0.92),
      superior: valores.map((v) => Math.min(1, v * 1.08)),
      marcas: [{ mes: 6.9, valor: 0.5, rotulo: '6,9 meses' }],
    },
    { rotulo: 'Série ilustrativa B', cor: 'b', meses: meses.slice(0, 19), valores: meses.slice(0, 19).map((m) => Math.exp(-m / 6)) },
  ],
  { descricao: 'Gráfico ilustrativo.', rotuloX: 'meses', rotuloY: 'ainda sem sentença', nota: 'A série B termina antes: exemplo de corte por base pequena.' },
);

// Detalhes expansíveis
secao('Detalhes expansíveis', 'Resumo compreensível; informação técnica secundária; operação por teclado.', ['Como calculamos', comoCalculamos(ILUSTRATIVO)]);
