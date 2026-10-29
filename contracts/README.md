# Contrato de dados — versão 1.1.0

Este é o único ponto de contato entre `ml/` e `web/`. O ML produz
`data/publicado/curvas.json` neste formato; o Web lê e nada mais.

Arquivos:

- `curvas.schema.json` — JSON Schema (draft 2020-12) do arquivo publicado.
- `validar.py` — validador em Python puro (sem dependências) que checa o schema
  estrutural **e** os invariantes matemáticos. Rode em todo JSON publicado ou consumido:
  `python3 contracts/validar.py data/publicado/curvas.json`
- `fixtures/curvas.exemplo.json` — fixture sintética para o Web desenvolver sem o ML.
  Regenerar com `python3 contracts/fixtures/gerar_exemplo.py`.

## Formato de `curvas.json`

```jsonc
{
  "contrato": "1.1.0",
  "gerado_em": "2026-10-28T15:00:00Z",      // ISO-8601 UTC
  "snapshot": "2026-10-28",                 // data da coleta = data de censura
  "sintetico": false,                       // true só em fixtures
  "fonte": {
    "nome": "Conselho Nacional de Justiça — DataJud, API Pública",
    "url": "https://datajud-wiki.cnj.jus.br/api-publica/",
    "citacao": "Fonte: CNJ/DataJud. Snapshot de 28/10/2026."   // texto do rodapé
  },
  "tribunal": "TJSP",
  "grau": "G1",
  "evento": "Primeiro movimento da família Julgamento (TPU 193 e filhos)",
  "grade_meses": [0, 1, 2, ..., 120],       // inteiros, crescentes, começa em 0
  "varas":   [{ "codigo": "1234", "nome": "3ª Vara Cível", "municipio": "Sorocaba" }],
  "classes": [{ "codigo": "7",    "nome": "Procedimento Comum Cível" }],
  "curvas": [
    {
      "vara":   "1234",          // código em `varas`, ou null = todas as varas
      "classe": "7",             // código em `classes`, ou null = todas as classes
      "metodo": "kaplan-meier",
      "n": 1820, "eventos": 1301, "censurados": 519,   // n = eventos + censurados
      "sobrevivencia": [1.0, 0.98, ...],  // mesmo tamanho de grade_meses, não crescente, em [0,1]
      "ic_inferior":   [1.0, 0.97, ...],  // IC 95%; ic_inferior <= sobrevivencia <= ic_superior
      "ic_superior":   [1.0, 0.99, ...],
      "greenwood_acumulado": [0.0, 0.00001, ...],  // opcional (1.1.0); σ²(t) = Σ d/(n(n−d)), não decrescente
      "quantis_meses": { "p50": 14.2, "p80": 27.9, "p90": null }   // null = não atingido na janela
    }
  ]
}
```

Regras:

- Deve existir pelo menos a curva agregada (`vara: null, classe: null`).
- Curvas com `n < 30` não devem ser publicadas (privacidade e ruído). O validador avisa.
- `sobrevivencia[0]` é sempre `1.0`.
- `ic_inferior`/`ic_superior` são o IC 95% de S(t) na escala log(−log S) (Kalbfleisch–Prentice,
  padrão do `lifelines`), com variância de Greenwood. Razão entre limites **não** é IC da
  probabilidade condicional; para isso existe `greenwood_acumulado`.
- `greenwood_acumulado` (opcional desde 1.1.0) é σ²(t) = Σ_{tᵢ ≤ t} dᵢ / (nᵢ (nᵢ − dᵢ)) avaliada
  na grade. Permite ao site calcular Var(log S(t+h)/S(t)) = σ²(t+h) − σ²(t) e daí o IC de
  P(sentença nos próximos h meses | tramita há t). Quando ausente, a UI diz que não há IC.
- Como o Web usa: P(sentença nos próximos *h* meses | tramita há *t*) = `1 − S(t+h)/S(t)`,
  interpolando `S` linearmente entre pontos da grade. Se `S(t)` for `0`, a resposta é indefinida
  e a UI deve dizer isso em vez de mostrar número.

## Evolução

- **1.1.0** (2026-10-29): campo opcional `greenwood_acumulado` por curva; documentada a
  transformação dos `ic_*`.
- **1.0.0** (2026-10-28): versão inicial.

Mudanças compatíveis (campo novo opcional) sobem o *minor*: 1.1.0. Mudanças que
quebram o Web sobem o *major*. Toda mudança: atualizar schema, validador, fixture, este
README e abrir item em `docs/HANDOFF.md`. Candidatos já previstos para 1.x: tabela de
hazard ratios do Cox, curvas por ano de ajuizamento, métricas de validação temporal.
