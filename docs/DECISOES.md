# Decisões de arquitetura

Registro curto, um ADR por decisão. Para reverter uma decisão, escreva um novo ADR
que a substitua; não edite o antigo.

## ADR-001 — Sem LLM, sem serviço externo
Reprodutível por qualquer pessoa com Python. No estágio 3 nem internet precisa.

## ADR-002 — Snapshot versionado no git
A API do DataJud é instável; o dado congelado em Parquet é o produto. Quem clona
começa no estágio 2 ou 3 sem chave e sem internet.

## ADR-003 — Recorte pequeno antes de largo
TJSP, 1º grau, uma ou poucas comarcas (Sorocaba, Campinas), duas ou três classes
com fim bem definido, ajuizados entre 2018 e 2024.

## ADR-004 — Validação temporal
Treina em ajuizados até 2021, testa em 2022 em diante. Split aleatório mentiria,
porque o uso real é prever processos novos.

## ADR-005 — Site estático
HTML/JS servido como arquivos, hospedável no GitHub Pages. Zero custo, zero
manutenção. Toda a matemática da tela "Meu processo" roda no navegador a partir do
JSON pré-computado. Um backend só entra se uma funcionalidade concreta exigir
(ex.: consulta por número CNJ) e com ADR próprio.

## ADR-006 — Duas frentes, fronteira pelo contrato de dados (2026-10-28)
O trabalho é dividido em duas frentes independentes, pipeline (`ml/`) e site
(`web/`), desenvolvidas em paralelo. A única interface é o JSON descrito em
`contracts/`. Motivo: os dois lados têm ritmos e ferramentas diferentes (Python
científico vs. front-end), e um contrato explícito permite ao site avançar com uma
fixture sintética enquanto o pipeline ainda coleta dados. Mudanças no contrato passam
por `docs/HANDOFF.md`.

## ADR-007 — Curvas em grade mensal fixa
O JSON publicado traz S(t) avaliada em meses inteiros (0, 1, 2, …), não nos tempos
de evento originais. Perde-se um pouco de resolução, ganha-se um contrato simples:
o navegador calcula P(sentença nos próximos h meses | tramita há t) como
1 − S(t+h)/S(t) com interpolação linear, sem nenhuma biblioteca.

## ADR-008 — Brutos compactados versionados enquanto o recorte for pequeno (2026-10-29)
A API do DataJud responde em 40 a 50 s por requisição e recusa boa parte delas em
horário de pico, então uma coleta leva horas e precisa ser retomável de qualquer máquina
(inclusive sessões na nuvem, que começam de um checkout limpo). As páginas brutas passam a
ser gravadas em `.jsonl.gz` (cerca de 0,7 KB por processo; as nove varas de Sorocaba cabem em
uns 30 MB) e entram no git junto com o `manifest.json`. Isso complementa a ADR-002: o
Parquet continua sendo o produto, e agora o estágio 2 também é reproduzível. Quando um
recorte passar de ~100 MB compactados, os brutos voltam a ficar fora do git e só o
manifesto é versionado, como previa o plano original.

## ADR-009 — Processos de sistema sem movimentos de julgamento ficam na base, com flag (2026-11-03)
No snapshot 2026-10-29, os 376 processos de Sorocaba vindos do Projudi (1% do total, quase
todos ajuizados em 2023–2024) não trazem nenhum movimento da família Julgamento em 22.772
movimentos, enquanto no SAJ 80% dos processos têm sentença. É lacuna do envio ao DataJud,
não do processo. Eles permanecem no Parquet, marcados com a flag `sistema_sem_julgamento`
(lista em `preparo.sistemas_sem_julgamento` do config), e o relatório de qualidade mostra a
censura por sistema. Cada modelo decide se os usa; as curvas Kaplan-Meier publicadas os
mantêm, porque excluí-los seria escolher a amostra pelo resultado. Revisar quando o TJSP
regularizar o envio ou quando a fração passar de uns 5%.

## ADR-010 — Decisões de embargos de declaração não contam como sentença (2026-11-03)
A família Julgamento da TPU inclui os códigos 198, 200, 871 e 15408 (acolhimento,
não-acolhimento, acolhimento parcial e não conhecimento de embargos de declaração). Embargos
respondem a uma decisão anterior; quando a decisão embargada é interlocutória, o código
aparece antes da sentença. No snapshot 2026-10-29 isso acontecia em 433 processos (1,4%); em
364 deles havia sentença de mérito depois, em mediana 430 dias mais tarde. O evento passa a
ser o primeiro movimento da família Julgamento fora dessa lista (`evento_sentenca.excluir_codigos`
no config). Um processo cuja única decisão da família é de embargos fica censurado.

## ADR-011 — Marcos além da sentença e regra para transições (2026-11-03)
O preparo passa a registrar, por processo, a data do primeiro movimento de cada marco listado em
`marcos` no config: audiência (TPU 970 e 12624), trânsito em julgado (848), início do cumprimento
de sentença (11385) e extinção da execução (196). A sentença continua definida pelo ADR-010. No
snapshot 2026-10-29: trânsito em 13.030 processos (ordem coerente, 15 casos antes da sentença),
início do cumprimento em 6.281, extinção da execução em 1.626, audiência em 2.991 (7,8%; a vara
cível de Sorocaba quase não registra audiência). Baixa definitiva (22) fica fora: aparece em 4.307
processos, 4.047 deles sem trânsito registrado, sinal de subnotificação que enviesaria a curva.
"Citação" não existe no que o TJSP envia e o complemento da "Conclusão" raramente diz "para
julgamento"; ambos descartados. Regra para as curvas por transição: o destino tem que ser um marco
que quase todo processo alcança (sentença, trânsito em julgado, extinção da execução para quem
iniciou o cumprimento); a origem pode ser qualquer marco. Transições publicadas: ajuizamento →
sentença, ajuizamento → trânsito, sentença → trânsito, audiência → sentença, início do
cumprimento → extinção da execução.

## ADR-012 — Trânsito em julgado e execução não se medem só com o registro de 1º grau (2026-11-03)
Ao modelar as transições do ADR-011 ficou claro que o registro de 1º grau não contém o fim do
processo quando há recurso: entre os sentenciados até 2020, só 40–50% têm trânsito em julgado
(28% nas improcedências), e uma consulta por número à API mostrou que, no caso de apelação, o
trânsito e a baixa definitiva estão no registro de 2º grau do mesmo número, que o snapshot não
coletou. Na execução, o início do cumprimento (11385) só passa a ser enviado em 2021 e a extinção
(196) quase nunca o segue (79 de 6.267), porque no TJSP o cumprimento de sentença ganha número
próprio. Publicar essas curvas superestimaria o tempo: o que não foi registrado viraria censura.
Decisão: publicar por ora só ajuizamento → sentença e audiência → sentença; as datas dos marcos
continuam no Parquet. Próximo passo: coletar o 2º grau dos mesmos números e medir se o trânsito
fica completo; só então sentença → trânsito entra. A execução fica fora até haver como ligá-la.

## ADR-013 — Coleta do 2º grau pelos mesmos números, fundida no preparo (2026-11-03)
Para medir o trânsito em julgado quando há recurso (ADR-012), o pipeline ganha um estágio 1b:
`coletar-g2` lê os números do snapshot de 1º grau fechado e baixa os registros de grau de recurso
dos mesmos números em lotes de 100 (filtro `terms` em `numeroProcesso`), um arquivo por lote em
`raw/<snapshot>-g2/`, com manifesto próprio e partes paralelas (`--parte i/n`). O snapshot de 1º
grau continua imutável. No preparo, os movimentos de 2º grau entram só nos marcos marcados com
`com_recurso` (hoje, trânsito em julgado), e tudo o que vier depois da data do snapshot de 1º grau
é ignorado e contado: assim há uma única data de censura. O Parquet ganha `registros_recurso` e
`classe_recurso`, e `eventos.parquet` ganha a coluna `grau`. A sentença segue sendo a de 1º grau.
Uma transição com destino no trânsito só é publicada depois que o relatório de qualidade mostrar
o registro completo o bastante por ano da sentença.
Resultado (2026-11-04): 9.911 registros de 2º grau para 9.442 números (24,5% dos processos; 8.049
apelações). A fusão subiu a cobertura do trânsito de 34% para 39% dos processos, e entre os
sentenciados até 2023 ela fica em 46–60%; no próprio registro de 2º grau só 24% das apelações têm
o código 848. O trânsito em julgado não é registrado de forma confiável em nenhum dos graus, então
sentença → trânsito continua fora (ADR-012 confirmado). O que o 2º grau torna observável é a
apelação: 79% dos registros de Apelação Cível têm movimento de julgamento (92–96% nas entradas de
2024–2025), mediana de 66 dias da entrada ao julgamento. "Entrada em 2º grau → julgamento da
apelação" é candidata a transição, com a ressalva da subnotificação nas coortes antigas.

## ADR-014 — Páginas de 300 com `_source` enxuto e jitter no backoff (2026-11-03)
Medido à noite numa vara de Sorocaba: página de 300 documentos inteira = 2,3 MB em 50 s; com
`_source` restrito aos campos que o pipeline usa = 1,3 MB em 40 s; o snapshot 2026-10-29 usou
páginas de 50 inteiras, seis vezes mais requisições. O servidor leva 30 a 50 s por consulta
independentemente do tamanho, então o número de requisições é o que manda no tempo total. A
partir daqui o coletor pede páginas de 300 com `api.campos` (lista no config); ficam de fora
`complementosTabelados` e `movimentos.orgaoJulgador`, que nenhum estágio lê. Isso ajusta o
ADR-008: o raw continua guardando o hit (`_id`, `_source`, `sort`), mas o `_source` é parcial, e
o manifesto registra os campos. O backoff ganha jitter (×0,5 a ×1,5) para processos paralelos não
repetirem em sincronia. Projetos abertos que usam a API (datajud-pipeline, datajud-mcp, juscraper)
chegam às mesmas práticas: `search_after`, retry só em erro transitório, checagem de shards e
limite de 120 req/min; nenhum tem truque além disso.
