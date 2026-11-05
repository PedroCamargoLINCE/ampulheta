// Consulta por número (ADR-016): função mínima e sem estado entre o site e a API Pública do
// DataJud, que não aceita CORS. Faz uma única coisa: recebe um número CNJ do TJSP, busca esse
// número na API com a chave pública e devolve classe, órgão julgador, data de ajuizamento e
// movimentos (código e data). Nada é gravado; nenhum outro tipo de consulta é aceito.

const API = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search';
/** A API leva de 30 a 50 s e às vezes mais; o Worker não paga CPU enquanto espera. */
const LIMITE_MS = 90_000;
const CAMPOS = ['numeroProcesso', 'grau', 'classe', 'orgaoJulgador', 'dataAjuizamento', 'movimentos.codigo', 'movimentos.dataHora'];

/** Só os 20 dígitos do número CNJ (aceita pontos, traços e espaços); null se não forem 20. */
export function normalizarNumero(texto) {
  const digitos = String(texto ?? '').replace(/[\s.\-]/g, '');
  return /^\d{20}$/.test(digitos) ? digitos : null;
}

/** Confere os dígitos verificadores (Resolução CNJ 65/2008: módulo 97). */
export function digitosConferem(d) {
  const [seq, dv, ano, j, tr, origem] = [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13), d[13], d.slice(14, 16), d.slice(16)];
  const n = BigInt(`${seq}${ano}${j}${tr}${origem}00`);
  return 98n - (n % 97n) === BigInt(dv);
}

/** Segmento 8 (Justiça Estadual), tribunal 26 (TJSP): o índice consultado é o do TJSP. */
export function doTJSP(d) {
  return d[13] === '8' && d.slice(14, 16) === '26';
}

/** "20181026104242" ou "2021-02-10T17:05:44.000Z" → "2018-10-26". */
export function dataIso(valor) {
  const s = String(valor ?? '');
  if (/^\d{8}/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/** Corta os hits da API no que o site usa. Um processo pode ter um registro por grau. */
export function resumir(numero, hits) {
  return {
    numero,
    registros: hits.map(({ _source: s }) => ({
      grau: s.grau ?? null,
      classe: s.classe ? { codigo: String(s.classe.codigo), nome: s.classe.nome } : null,
      orgaoJulgador: s.orgaoJulgador ? { codigo: String(s.orgaoJulgador.codigo), nome: s.orgaoJulgador.nome } : null,
      dataAjuizamento: dataIso(s.dataAjuizamento),
      movimentos: (s.movimentos ?? [])
        .filter((m) => m.codigo !== undefined && dataIso(m.dataHora))
        .map((m) => ({ codigo: Number(m.codigo), data: dataIso(m.dataHora) })),
    })),
  };
}

function cabecalhosCors(origem, env) {
  const permitidas = String(env.ORIGENS_PERMITIDAS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const cab = { Vary: 'Origin' };
  if (origem && permitidas.includes(origem)) {
    cab['Access-Control-Allow-Origin'] = origem;
    cab['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return cab;
}

function json(corpo, status, cors) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });
}

export default {
  /** GET /?numero=<CNJ>. Pedido simples (sem cabeçalho próprio), então o navegador nem faz preflight. */
  async fetch(request, env, _ctx, buscar = fetch) {
    const cors = cabecalhosCors(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ erro: 'Só GET é aceito.' }, 405, cors);

    const numero = normalizarNumero(new URL(request.url).searchParams.get('numero'));
    if (!numero) return json({ erro: 'Informe os 20 dígitos do número do processo.' }, 400, cors);
    if (!digitosConferem(numero)) return json({ erro: 'Os dígitos verificadores não conferem. Confira o número.' }, 400, cors);
    if (!doTJSP(numero)) return json({ erro: 'Por enquanto só consultamos processos do TJSP (número terminando em .8.26.xxxx).' }, 400, cors);
    if (!env.DATAJUD_API_KEY) return json({ erro: 'A consulta está sem chave configurada.' }, 500, cors);

    let resposta;
    try {
      resposta = await buscar(API, {
        method: 'POST',
        headers: { Authorization: `APIKey ${env.DATAJUD_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 10, query: { match: { numeroProcesso: numero } }, _source: CAMPOS }),
        signal: AbortSignal.timeout(LIMITE_MS),
      });
    } catch {
      return json({ erro: 'O DataJud não respondeu a tempo.', tentarDeNovo: true }, 504, cors);
    }
    if (resposta.status === 429 || resposta.status >= 500) {
      return json({ erro: 'O DataJud está sobrecarregado agora.', tentarDeNovo: true }, 503, cors);
    }
    if (!resposta.ok) return json({ erro: `O DataJud recusou a consulta (HTTP ${resposta.status}).` }, 502, cors);

    const dados = await resposta.json();
    const hits = dados?.hits?.hits ?? [];
    // Sob carga, a API responde 200 com parte dos shards recusada e a lista de resultados
    // incompleta (visto em 2026-11-05: total 1, nenhum hit, 1 de 20 shards falhou). Sem o
    // registro de 1º grau, isso não é "número inexistente": é "tente de novo".
    // Mesmo critério do coletor do pipeline (ml/src/ampulheta/coletor.py).
    const incompleto = Boolean(dados?.timed_out) || (dados?._shards?.failed ?? 0) > 0;
    const temG1 = hits.some((h) => h?._source?.grau === 'G1');
    if (incompleto && !temG1) {
      return json({ erro: 'O DataJud respondeu só em parte agora.', tentarDeNovo: true }, 503, cors);
    }
    if (hits.length === 0) return json({ erro: 'O DataJud não tem esse número.' }, 404, cors);
    return json(resumir(numero, hits), 200, cors);
  },
};
