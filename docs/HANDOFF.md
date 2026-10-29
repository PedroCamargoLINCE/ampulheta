# Pendências entre `ml/` e `web/`

Quem trabalha em uma frente lê este arquivo ao começar e escreve aqui ao terminar.
Itens mais novos em cima. Quem atende um item muda o status para `resolvido` e
anota a data.

Formato:

```
## AAAA-MM-DD · DE → PARA · título
Status: aberto | resolvido (AAAA-MM-DD)
O que mudou / o que preciso:
Ação esperada do outro lado:
```

---

## 2026-10-29 · ML → Web · primeiro `data/publicado/curvas.json` real
Status: aberto
O que mudou: o snapshot `2026-10-29` fechou (nove varas cíveis de Sorocaba, 38.524 processos,
79,3% com sentença) e `publicar.py` gerou `data/publicado/curvas.json` no contrato 1.1.0, com
36 curvas (agregada, 9 varas, 3 classes, 23 vara × classe com n ≥ 30) numa grade de 0 a 106
meses. Validador: `VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)` em modo estrito.
Ação esperada: rodar o build do site; ele deve sair da fixture sozinho. Mediana agregada de
17,3 meses; despejo por falta de pagamento (classe 93) cai para 3,6. A 9ª Vara não atinge p80
nem p90 na janela (`null`), e a 8ª tem p80 = p90 por salto no fim da curva; a UI precisa
aceitar isso.

## 2026-10-29 · ML → ML · observações de qualidade do snapshot 2026-10-29
Status: aberto
O que mudou: `data/relatorio_qualidade.md` (gerado) mostra dois pontos a decidir antes das
camadas Cox e boosting. (1) Os 376 processos do sistema Projudi (1%, quase todos de 2023–2024)
não trazem nenhum movimento da família Julgamento e saem 90,7% censurados; é lacuna do dado de
origem e infla levemente a censura dos anos recentes. (2) Em 433 processos a primeira
"sentença" é decisão de embargos de declaração (TPU 198, 200, 871) e em 369 deles há sentença
de mérito depois; a definição operacional do evento (família 193 inteira) é decisão fechada.
Ação esperada: avaliar um ADR que exclua os processos do Projudi e/ou retire os códigos de
embargos da definição do evento; até lá nada muda no pipeline.

## 2026-10-29 · ML → Web · contrato 1.1.0: `greenwood_acumulado` e transformação dos IC
Status: aberto
O que mudou: `contracts/` está na versão 1.1.0. Cada curva pode trazer o campo opcional
`greenwood_acumulado` (σ²(t) = Σ d/(n(n−d)) na grade, não decrescente, começa em 0), e o
README do contrato documenta que `ic_*` são IC 95% na escala log(−log S) com variância de
Greenwood. `publicar.py` já emite o campo; a fixture foi regenerada com ele; o validador o
checa quando presente.
Ação esperada: calcular na tela Meu processo o IC de P(sentença em h | t) via
Var(log S(t+h)/S(t)) = σ²(t+h) − σ²(t), e manter o aviso "sem IC" quando o campo faltar.

## 2026-10-29 · ML → todos · estado da coleta e como continuar em outra máquina
Status: resolvido (2026-10-29) — snapshot `2026-10-29` fechado com `manifest.json`: 38.524 processos
em 753 páginas, nove varas (de 1.191 na 9ª a 5.482 na 3ª); diferença de 6 processos em relação aos
totais finais da API (índice atualizado durante a coleta, registrado no manifesto). Pipeline rodou
até `publicar`; 36 curvas; validador `VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)`.
O que mudou: pipeline inteiro implementado em `ml/` (coletor, preparo, Kaplan-Meier,
publicação) e validado de ponta a ponta com dado real; ver `ml/README.md`. O snapshot
`2026-10-29` está **aberto** (sem `manifest.json`), com páginas compactadas versionadas em
`ml/raw/2026-10-29/` (ADR-008): vara 10672 com 2.650 de ~5.300 processos, varas 10671 e
10673 com 200 cada; as outras seis varas ainda não começaram. A API do CNJ responde em
40–50 s por requisição e recusa muitas em horário de pico; a coleta é lenta mas retomável.
Ainda **não** existe `data/publicado/curvas.json` real: só sai quando o snapshot fechar.
Ação esperada (quem continuar o ML): em um checkout do branch, com
`export DATAJUD_API_KEY=<chave vigente em datajud-wiki.cnj.jus.br/api-publica/acesso>`, rodar
em paralelo um processo por vara, `ampulheta coletar --snapshot 2026-10-29 --vara <codigo>`
(três a quatro de cada vez; cada um faz no máximo uma requisição por minuto). Commitar
`ml/raw/2026-10-29/` periodicamente para não perder progresso. Quando todas as varas
tiverem `total_esperado.txt`, rodar `ampulheta coletar --snapshot 2026-10-29` sem `--vara`
para fechar o manifesto, depois `preparar --snapshot 2026-10-29`, `modelar`, `publicar`,
e registrar aqui o snapshot com o resultado do validador.
Obrigação do termo de uso do CNJ (cláusula 3.9): dar ciência ao CNJ antes de publicar
estudo ou painel com os dados; a cláusula 3.8 proíbe exploração comercial sem autorização
escrita. Anotado também em `ml/README.md`.

## 2026-10-29 · Web → ML · intervalo de confiança da probabilidade condicional
Status: resolvido (2026-10-29) — ver item "contrato 1.1.0" acima
O que preciso: a tela Meu processo mostra P(sentença em h meses | tramita há t) sem
intervalo, porque não dá para derivá-lo de `ic_inferior`/`ic_superior` (o contrato não
diz a transformação usada, e razão de limites não é IC). Com a soma acumulada de
Greenwood σ²(t) = Σ d/(n(n−d)) na grade, o site calcula o IC exato da razão:
Var(log S(t+h)/S(t)) = σ²(t+h) − σ²(t).
Ação esperada: avaliar publicar um campo opcional por curva, por exemplo
`greenwood_acumulado: number[]` do mesmo tamanho de `grade_meses` (contrato 1.1.0),
e dizer no README do contrato qual transformação gera `ic_*` (plain, log ou log-log).
Até lá o site informa que essas probabilidades não têm IC próprio.

## 2026-10-29 · Web → todos · site roda contra a fixture
Status: aberto
O que mudou: `web/` tem as telas Explorar e Meu processo funcionando com a fixture.
`npm run build` valida o JSON com `contracts/validar.py` e usa
`data/publicado/curvas.json` automaticamente quando ele existir.
Ação esperada: nenhuma. Quando o primeiro JSON real sair, basta rodar o build de novo.

## 2026-10-28 · Setup → ML · contrato v1.0.0 publicado
Status: resolvido (2026-10-29) — snapshot `2026-10-29`, contrato 1.1.0, `VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)`.
O que mudou: `contracts/` define o JSON de curvas Kaplan-Meier que `publicar.py`
deve gerar. Há fixture sintética em `contracts/fixtures/curvas.exemplo.json`.
Ação esperada: quando `publicar.py` gerar o primeiro `data/publicado/curvas.json`
real, rodar `python3 contracts/validar.py data/publicado/curvas.json` e registrar
aqui o snapshot usado.

## 2026-10-28 · Setup → Web · desenvolva contra a fixture
Status: aberto
O que mudou: ainda não existe dado real em `data/publicado/`. Use
`contracts/fixtures/curvas.exemplo.json` (sintético, Weibull) para construir as
duas telas. O site deve carregar `data/publicado/curvas.json` quando existir e cair
na fixture quando não existir, deixando visível na tela que o dado é sintético.
Ação esperada: nenhuma além de respeitar o contrato. Se faltar campo, abra um item
aqui para o ML.
