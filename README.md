# Ampulheta

Quanto tempo esse processo ainda vai levar? Estimativa da distribuição do tempo até
a sentença em 1º grau, com incerteza honesta, usando análise de sobrevivência sobre
dados públicos do CNJ/DataJud. Sem LLM, sem serviço pago.

- Plano e método: [`docs/PLANO.md`](docs/PLANO.md)
- Decisões de arquitetura: [`docs/DECISOES.md`](docs/DECISOES.md)
- Contrato de dados entre pipeline e site: [`contracts/README.md`](contracts/README.md)
- Pipeline (Python): [`ml/`](ml/)
- Site: [`web/`](web/)

## Estrutura

| Pasta | O que é |
| --- | --- |
| `ml/` | pacote Python `ampulheta`: coleta, preparo, modelagem, publicação |
| `web/` | site estático que consome o JSON publicado |
| `contracts/` | formato do JSON entre pipeline e site, validador e fixture |
| `data/` | Parquet versionado e `data/publicado/curvas.json` |
| `docs/` | plano, decisões de arquitetura e pendências entre as duas frentes |

Fonte: Conselho Nacional de Justiça — DataJud. Resultados e limitações serão
preenchidos conforme o pipeline avançar.
