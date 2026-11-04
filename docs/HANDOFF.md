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

## 2026-11-04 · ML → todos · brutos de Campinas e São Paulo; São Paulo em Git LFS
Status: aberto
O que mudou: `raw/campinas/2026-11-04/` (15 varas, 75.910 processos, 45 MB) está completo e
versionado como arquivo comum. `raw/sao-paulo/2026-11-04/` (124 varas, ~870 mil processos,
>300 MB) está em coleta e suas páginas `.jsonl.gz` são objetos Git LFS (ADR-015); manifesto e
totais seguem como texto. Nada foi preparado nem publicado ainda com esses recortes; o
`curvas.json` continua só com Sorocaba.
Ação esperada: nenhuma para o site. O checkout do CI não baixa LFS e o site não lê `ml/raw/`.
Quem for rodar o preparo de São Paulo roda antes `git lfs pull --include="ml/raw/sao-paulo/**"`.

## 2026-11-04 · ML → todos · 2º grau coletado: trânsito segue fora; apelação é observável
Status: aberto
O que mudou: `raw/2026-10-29-g2/` (ADR-013) tem os registros de 2º grau dos 38.491 números do
snapshot (9.911 registros, 24,5% dos processos com recurso). O preparo funde esses movimentos no
trânsito em julgado, mas a cobertura só vai de 34% para 39%: o código 848 não é enviado de forma
confiável em nenhum grau, então nenhuma curva com destino no trânsito é publicada. O Parquet
ganhou `registros_recurso` e `classe_recurso`; `eventos.parquet` tem os movimentos de 2º grau com
`grau = G2`. Curvas publicadas não mudaram (ajuizamento → sentença e audiência → sentença).
Ação esperada: nenhuma para o site. Para o pipeline, decidir se "entrada em 2º grau → julgamento
da apelação" entra como transição (79% com julgamento registrado, mediana 66 dias).

## 2026-11-03 · ML → Web · contrato 1.3.0: curvas por transição (`origem`/`destino`) e `marcos`
Status: aberto
O que mudou: `contracts/` está na versão 1.3.0. Cada curva traz `origem` e `destino` (ausentes =
ajuizamento → sentença) e o documento traz `marcos`, a lista de etapas com os códigos TPU que as
caracterizam. `data/publicado/curvas.json` tem agora 54 curvas: as 36 de ajuizamento → sentença de
sempre e 18 de audiência → sentença (agregada n = 2.957, mediana 9,4 meses contra 17,7 desde o
ajuizamento). Validador: `VÁLIDO — 54 curva(s), 0 erro(s), 0 aviso(s)`. Trânsito em julgado e
execução não entraram: o registro de 1º grau não os contém quando há recurso (ADR-012); vêm
depois da coleta do 2º grau.
Ação esperada (roteiro A3): filtrar as curvas por transição (hoje o site deve mostrar só
ajuizamento → sentença, senão mistura as duas); em Explorar, um seletor de transição; em Meu
processo, perguntar "já teve audiência?" e, se sim, usar a curva audiência → sentença contando o
tempo desde a audiência. `marcos.codigos_tpu` é o insumo para a consulta por número (A4).

## 2026-11-03 · ML → Web · contrato 1.2.0: `em_risco` por ponto da grade
Status: resolvido (2026-11-03) — limite de 10 em t e em t+h (`web/src/base.ts`): Explorar dados
corta a curva e marca os prazos além do corte como "não estimado"; Estimar tempo recusa número
no horizonte sem base e mostra quantos seguiam em acompanhamento no tempo informado
O que mudou: `contracts/` está na versão 1.2.0. Cada curva traz o campo opcional `em_risco`
(inteiros, mesmo tamanho de `grade_meses`, não crescente, começa em `n`, vale 0 depois do último
tempo observado). `publicar.py` já emite; fixture regenerada; validador checa quando presente.
`data/publicado/curvas.json` está no 1.2.0 (`VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)`). Na
8ª Vara, por exemplo, `em_risco` vai de 7 aos 36 meses a 1 aos 41 e 0 a partir de 42: o degrau
de S para 0 aos 42 meses é um único processo.
Ação esperada: cortar a curva na tela Explorar e recusar número em Meu processo onde `em_risco`
ficar abaixo do limite escolhido pelo site (sugestão no README do contrato: 10 em t e em t+h);
tratar 0 como "KM não definido".

## 2026-11-03 · ML → Web · curvas regeneradas (ADR-010) e relatório do modelo Cox
Status: aberto
O que mudou: a definição do evento deixou de contar decisões de embargos de declaração como
sentença (ADR-010) e os processos do Projudi ganharam flag, sem sair da base (ADR-009).
`data/publicado/curvas.json` foi regenerado no mesmo contrato 1.1.0: 36 curvas, validador
`VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)`; a mediana agregada foi de 17,3 para 17,7 meses
e a maior diferença em S(t) entre as curvas é de 0,07. Entrou a camada 2 do modelo
(`ml/cox.py`): hazard ratios por vara e classe, validação temporal e calibração, em
`data/relatorio_modelo.md` e `ml/models/cox.json`; nada disso entra no contrato por enquanto.
Ação esperada: rodar o build de novo. Se quiser mostrar os hazard ratios na tela Explorar,
abrir um item aqui para definirmos a extensão do contrato.

## 2026-10-30 · Web → ML · número em risco por ponto da grade (contrato 1.2.0)
Status: resolvido (2026-11-03) — ver item "contrato 1.2.0: `em_risco`" acima
O que preciso: com o dado real, a cauda de várias curvas se apoia em pouquíssimos processos e o
site não tem como saber. Exemplos: na 9ª Vara, `greenwood_acumulado` salta de 0,0031 para 0,0365
entre 37 e 38 meses (cerca de 6 em risco) e S fica em 0,2283 até 106 meses, repetindo o último
valor além do último tempo observado, onde o KM não é definido; na 8ª, S cai de 0,26 para 0 aos
42 meses pelo último processo em risco, o que gera p80 = p90 = 41,6 e, em Meu processo, "100% em
6 meses" para quem tramita há 38 meses. As cruzadas vara × classe 93/94 (n ≈ 130–200) têm o mesmo
padrão. O aviso atual do site (S(t) < 5%) não pega esses casos, porque S fica alto e o que cai é
o risco por censura.
Ação esperada: publicar por curva o campo opcional `em_risco: number[]` (processos ainda em risco
em cada ponto de `grade_meses`, mesmo tamanho), subindo o contrato para 1.2.0. Com ele, o site
corta a curva onde o número em risco fica abaixo de um limite e, em Meu processo, recusa número
nesses trechos em vez de mostrar 0% ou 100%.

## 2026-10-29 · ML → Web · primeiro `data/publicado/curvas.json` real
Status: resolvido (2026-10-30) — o build usa o JSON real sozinho e a UI aceita quantis `null` e
p80 = p90; a cauda pouco sustentada virou o item "número em risco" acima
O que mudou: o snapshot `2026-10-29` fechou (nove varas cíveis de Sorocaba, 38.524 processos,
79,3% com sentença) e `publicar.py` gerou `data/publicado/curvas.json` no contrato 1.1.0, com
36 curvas (agregada, 9 varas, 3 classes, 23 vara × classe com n ≥ 30) numa grade de 0 a 106
meses. Validador: `VÁLIDO — 36 curva(s), 0 erro(s), 0 aviso(s)` em modo estrito.
Ação esperada: rodar o build do site; ele deve sair da fixture sozinho. Mediana agregada de
17,3 meses; despejo por falta de pagamento (classe 93) cai para 3,6. A 9ª Vara não atinge p80
nem p90 na janela (`null`), e a 8ª tem p80 = p90 por salto no fim da curva; a UI precisa
aceitar isso.

## 2026-10-29 · ML → ML · observações de qualidade do snapshot 2026-10-29
Status: resolvido (2026-11-03) — ADR-009 (Projudi fica na base, com flag `sistema_sem_julgamento`)
e ADR-010 (decisões de embargos não contam como sentença) em `docs/DECISOES.md`; preparo, Parquet
e curvas regenerados.
O que mudou: `data/relatorio_qualidade.md` (gerado) mostra dois pontos a decidir antes das
camadas Cox e boosting. (1) Os 376 processos do sistema Projudi (1%, quase todos de 2023–2024)
não trazem nenhum movimento da família Julgamento e saem 90,7% censurados; é lacuna do dado de
origem e infla levemente a censura dos anos recentes. (2) Em 433 processos a primeira
"sentença" é decisão de embargos de declaração (TPU 198, 200, 871) e em 369 deles há sentença
de mérito depois; a definição operacional do evento (família 193 inteira) é decisão fechada.
Ação esperada: avaliar um ADR que exclua os processos do Projudi e/ou retire os códigos de
embargos da definição do evento; até lá nada muda no pipeline.

## 2026-10-29 · ML → Web · contrato 1.1.0: `greenwood_acumulado` e transformação dos IC
Status: resolvido (2026-10-29) — a tela Meu processo mostra o IC 95% em 3, 6 e 12 meses
(`intervaloSentenca` em `web/src/sobrevivencia.ts`) e mantém o aviso "sem IC" sem o campo
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
