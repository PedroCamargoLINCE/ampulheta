# ampulheta (pacote Python)

Pipeline em três estágios desacoplados que transforma processos do DataJud em curvas de
tempo até a sentença. Método completo em `../docs/PLANO.md`; decisões em `../docs/DECISOES.md`.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export DATAJUD_API_KEY=...        # chave pública, em datajud-wiki.cnj.jus.br/api-publica/acesso

ampulheta coletar  --snapshot 2026-10-29 --vara 10672     # estágio 1, uma vara; rode várias em paralelo
ampulheta coletar  --snapshot 2026-10-29                  # rodada final: confere as varas e fecha o manifesto
ampulheta preparar --snapshot 2026-10-29                  # estágio 2
ampulheta modelar                                         # estágio 3
ampulheta publicar                                        # gera e valida o JSON do contrato
python -m pytest                                          # testes
```

Cada estágio lê só o que o anterior escreveu. Quem clona o repositório pode começar em
`preparar` ou `modelar` sem chave e sem internet.

## O que cada módulo faz

**`coletor.py`** (estágio 1). Para cada vara do `config.yaml`, monta uma consulta
Elasticsearch (grau, vara, classes, janela de ajuizamento) e pagina por `search_after`
ordenando por `@timestamp`. Cada página vira um arquivo `raw/<snapshot>/<tribunal>/<vara>/NNNNN.jsonl.gz`
com os hits inteiros, inclusive o campo `sort`, então retomar uma coleta interrompida, nesta ou em
outra máquina, é ler o `sort` da última linha gravada. As páginas compactadas são versionadas
(ADR-008), por isso a coleta pode continuar de qualquer checkout do repositório. Em 429, 5xx e erro de conexão espera com backoff exponencial
(5 s a 1 min, sem desistir); resposta 200 com shard
recusado é tratada como falha, porque aceitá-la perderia documentos em silêncio. Ao terminar escreve `manifest.json` (filtros, totais, hash de
cada arquivo); com manifesto presente a pasta é imutável e uma nova coleta exige outra data.
Rodadas com `--vara` não escrevem o manifesto, então várias podem correr em paralelo (uma por
processo); uma rodada final sem `--vara` confere cada vara e fecha o snapshot.

**`preparo.py`** (estágio 2). Lê os `.jsonl` do snapshot e gera em `../data/`:

- `processos.parquet`, uma linha por processo: vara, classe, assunto, `data_ajuizamento`,
  `data_evento` (primeiro movimento da família Julgamento), `data_censura` (= snapshot),
  `tempo_dias`, `evento` (1 sentenciado, 0 censurado), `tipo_sentenca` e `com_merito`
  (ramo da TPU), `n_movimentos`, `flags`.
- `eventos.parquet`, uma linha por movimento, para modelar outros eventos depois.
- `relatorio_qualidade.md`, gerado: contagem de cada regra de limpeza, censura por vara,
  classe e ano, distribuição dos tipos de sentença.

Regras, todas contadas: hit repetido na paginação é removido; ajuizamento fora de
[1990, snapshot] descarta; sentença antes do ajuizamento descarta; movimento de mesmo
código no mesmo dia é deduplicado; menos de dois movimentos ou movimento anterior ao
ajuizamento recebe flag (provável migração com histórico truncado).

**`tpu_julgamento.csv`**. Os 272 códigos da família Julgamento (193 e descendentes) extraídos
da Tabela Processual Unificada oficial (`gateway.cloud.pje.jus.br/tpu`, versão de
2025-09-11), com o ramo de cada um: `sem_merito` (218: extinção, desistência, abandono…) ou
`com_merito` (385: procedência, improcedência, homologação de transação…). É a definição
operacional de "sentença" do projeto.

**`modelo.py`** (estágio 3, camada 1). Kaplan-Meier com `lifelines` para o agregado, cada
vara, cada classe e cada vara × classe com n ≥ 30. S(t) é avaliada numa grade de meses
inteiros comum a todas as curvas (ADR-007), com IC 95% e quantis p50, p80, p90 (`null` quando
a curva não chega lá). Calcula também o log-rank entre varas. Escreve `models/km.json`.
As camadas Cox e boosting entrarão aqui, sempre com validação temporal (ADR-004).

**`publicar.py`**. Junta `models/km.json` ao cabeçalho exigido pelo contrato (snapshot,
citação ao CNJ/DataJud, dicionário de varas e classes) e grava
`../data/publicado/curvas.json`. Termina chamando `../contracts/validar.py --estrito`; se o
validador reprovar, o comando falha.

## Fatos da API confirmados na prática (2026-10-29)

- `dataAjuizamento` é string `AAAAMMDDhhmmss`; filtros de intervalo usam esse formato.
- `grau` é campo de texto: `term` não casa, `match` casa.
- `orgaoJulgador.nome` não aceita agregação (fielddata desligado); usar `top_hits`.
- Páginas de 1000 documentos são rejeitadas com 429/504; 100 respondem em ~30 s.
- Despejo por falta de pagamento no TJSP usa as classes 93 e 94, não a 12.
- A cobertura do TJSP no DataJud é desigual por comarca: a capital concentra o volume,
  e Sorocaba e Campinas têm poucos milhares de processos por ano no recorte.
- O servidor leva 40 a 50 s por requisição (campo `took`), para qualquer tamanho de página, e
  em pico devolve 504, 429 e respostas com shards recusados. O limite de 120 req/min nunca é
  o gargalo; o que ajuda é persistência, horário fora de pico e três ou quatro varas em paralelo.
- O índice é atualizado durante a coleta (o total de uma vara mudou entre consultas no mesmo
  dia); o preparo deduplica por `_id`.

## Termo de uso da API (obrigações)

Cláusula 3.9: dar ciência ao CNJ de qualquer estudo, relatório ou painel disponibilizado ao
público com os dados. Cláusula 3.8: não explorar comercialmente a API nem informação derivada
sem autorização prévia por escrito do CNJ. Cláusula 3.13: no máximo 120 requisições por minuto.
Fonte: formularios.cnj.jus.br/wp-content/uploads/2023/05/Termos-de-uso-api-publica-V1.1.pdf
