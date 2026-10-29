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
