// node --test: sem dependências; a API do CNJ é trocada por uma função falsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import funcao, { dataIso, digitosConferem, doTJSP, normalizarNumero, resumir } from '../src/index.js';

const NUMERO = '10403182120188260602'; // do snapshot 2026-10-29, 1ª Vara Cível de Sorocaba
const env = { DATAJUD_API_KEY: 'chave-de-teste', ORIGENS_PERMITIDAS: 'https://pedrocamargolince.github.io,http://localhost:5173' };
const pedir = (numero, origem = 'https://pedrocamargolince.github.io', metodo = 'GET') =>
  new Request(`https://consulta.exemplo/?numero=${encodeURIComponent(numero)}`, { method: metodo, headers: { Origin: origem } });
const respostaApi = (status, corpo) => async () => new Response(JSON.stringify(corpo), { status });

const HIT = {
  _source: {
    numeroProcesso: NUMERO,
    grau: 'G1',
    classe: { codigo: 7, nome: 'Procedimento Comum Cível' },
    orgaoJulgador: { codigo: 10669, nome: '01 CIVEL DE SOROCABA' },
    dataAjuizamento: '20181026104242',
    movimentos: [
      { codigo: 26, dataHora: '2018-10-26T10:46:42.000Z', complementosTabelados: [] },
      { codigo: 970, dataHora: '2019-03-01T13:00:00.000Z' },
      { dataHora: '2019-03-02T13:00:00.000Z' },
    ],
  },
};

test('normaliza o número com ou sem máscara', () => {
  assert.equal(normalizarNumero('1040318-21.2018.8.26.0602'), NUMERO);
  assert.equal(normalizarNumero(' 10403182120188260602 '), NUMERO);
  assert.equal(normalizarNumero('1040318-21.2018'), null);
  assert.equal(normalizarNumero(null), null);
});

test('confere dígitos verificadores e tribunal', () => {
  assert.equal(digitosConferem(NUMERO), true);
  assert.equal(digitosConferem('10403182220188260602'), false);
  assert.equal(doTJSP(NUMERO), true);
  assert.equal(doTJSP('10403188120188130602'), false);
});

test('lê as duas formas de data da API', () => {
  assert.equal(dataIso('20181026104242'), '2018-10-26');
  assert.equal(dataIso('2021-02-10T17:05:44.000Z'), '2021-02-10');
  assert.equal(dataIso('ontem'), null);
});

test('resumir devolve só o que o site usa e descarta movimento sem código', () => {
  const r = resumir(NUMERO, [HIT]);
  assert.deepEqual(r.registros[0], {
    grau: 'G1',
    classe: { codigo: '7', nome: 'Procedimento Comum Cível' },
    orgaoJulgador: { codigo: '10669', nome: '01 CIVEL DE SOROCABA' },
    dataAjuizamento: '2018-10-26',
    movimentos: [
      { codigo: 26, data: '2018-10-26' },
      { codigo: 970, data: '2019-03-01' },
    ],
  });
});

test('consulta válida: repassa só a busca por número, com a chave, e libera CORS para o site', async () => {
  let pedido;
  const r = await funcao.fetch(pedir('1040318-21.2018.8.26.0602'), env, {}, async (url, init) => {
    pedido = { url, init };
    return new Response(JSON.stringify({ hits: { hits: [HIT] } }), { status: 200 });
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://pedrocamargolince.github.io');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.match(pedido.url, /api_publica_tjsp\/_search$/);
  assert.equal(pedido.init.headers.Authorization, 'APIKey chave-de-teste');
  assert.deepEqual(JSON.parse(pedido.init.body).query, { match: { numeroProcesso: NUMERO } });
  assert.equal((await r.json()).registros[0].orgaoJulgador.codigo, '10669');
});

test('origem desconhecida não recebe CORS', async () => {
  const r = await funcao.fetch(pedir(NUMERO, 'https://outro.site'), env, {}, respostaApi(200, { hits: { hits: [HIT] } }));
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('recusa número inválido, de outro tribunal e método diferente de GET', async () => {
  const nunca = async () => assert.fail('não devia chamar a API');
  assert.equal((await funcao.fetch(pedir('123'), env, {}, nunca)).status, 400);
  assert.equal((await funcao.fetch(pedir('10403182220188260602'), env, {}, nunca)).status, 400);
  assert.equal((await funcao.fetch(pedir('10403188120188130602'), env, {}, nunca)).status, 400);
  assert.equal((await funcao.fetch(pedir(NUMERO, undefined, 'POST'), env, {}, nunca)).status, 405);
  assert.equal((await funcao.fetch(pedir(NUMERO, undefined, 'OPTIONS'), env, {}, nunca)).status, 204);
});

test('traduz sobrecarga, ausência e falta de chave', async () => {
  const cheio = await funcao.fetch(pedir(NUMERO), env, {}, respostaApi(429, {}));
  assert.equal(cheio.status, 503);
  assert.equal((await cheio.json()).tentarDeNovo, true);
  assert.equal((await funcao.fetch(pedir(NUMERO), env, {}, respostaApi(200, { hits: { hits: [] } }))).status, 404);
  const caiu = await funcao.fetch(pedir(NUMERO), env, {}, async () => {
    throw new Error('timeout');
  });
  assert.equal(caiu.status, 504);
  assert.equal((await funcao.fetch(pedir(NUMERO), { ...env, DATAJUD_API_KEY: '' }, {}, respostaApi(200, {}))).status, 500);
});

test('resposta parcial (shard recusado) sem 1º grau vira "tente de novo", não "não encontrado"', async () => {
  const parcial = { _shards: { total: 20, successful: 19, failed: 1 }, hits: { total: { value: 1 }, hits: [] } };
  const r = await funcao.fetch(pedir(NUMERO), env, {}, respostaApi(200, parcial));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).tentarDeNovo, true);
  const soG2 = { _shards: { failed: 1 }, hits: { hits: [{ _source: { ...HIT._source, grau: 'G2' } }] } };
  assert.equal((await funcao.fetch(pedir(NUMERO), env, {}, respostaApi(200, soG2))).status, 503);
  const comG1 = { _shards: { failed: 1 }, hits: { hits: [HIT] } };
  assert.equal((await funcao.fetch(pedir(NUMERO), env, {}, respostaApi(200, comG1))).status, 200);
});
