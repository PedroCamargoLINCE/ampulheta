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

## 2026-10-29 · Web → ML · intervalo de confiança da probabilidade condicional
Status: aberto
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
Status: aberto
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
