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
