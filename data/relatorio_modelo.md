# Relatório do modelo — snapshot 2026-10-29

Gerado por `ampulheta modelar`. Fonte: CNJ/DataJud, API Pública. Cox proporcional sobre 38524 processos (30497 com sentença).

## Hazard ratios (modelo ajustado em todos os processos)

Referências: 1ª Vara Cível de Sorocaba e Procedimento Comum Cível. Hazard ratio > 1 = sentença mais rápida que a referência. A coluna de proporcionalidade é o p do teste de Schoenfeld; p pequeno indica que o efeito muda ao longo do tempo e o hazard ratio deve ser lido como média no período.

| covariável                                           |   hazard ratio | IC 95%      |        p |   p proporcionalidade |
|:-----------------------------------------------------|---------------:|:------------|---------:|----------------------:|
| 2ª Vara Cível de Sorocaba                            |          1.466 | 1.402–1.532 | 1.1e-63  |              0.0065   |
| 3ª Vara Cível de Sorocaba                            |          1.424 | 1.363–1.488 | 1.6e-55  |              3.1e-10  |
| 4ª Vara Cível de Sorocaba                            |          1.375 | 1.316–1.438 | 3.7e-45  |              9.9e-06  |
| 5ª Vara Cível de Sorocaba                            |          1.858 | 1.776–1.942 | 1.1e-162 |              1.1e-17  |
| 6ª Vara Cível de Sorocaba                            |          1.256 | 1.201–1.314 | 1.8e-23  |              1.5e-12  |
| 7ª Vara Cível de Sorocaba                            |          1.672 | 1.6–1.747   | 6.1e-116 |              7.3e-06  |
| 8ª Vara Cível de Sorocaba                            |          1.455 | 1.353–1.565 | 5.1e-24  |              0.0012   |
| 9ª Vara Cível de Sorocaba                            |          1.344 | 1.246–1.451 | 2.6e-14  |              6.3e-10  |
| Despejo por Falta de Pagamento                       |          3.873 | 3.626–4.138 | 0        |              3.3e-113 |
| Despejo por Falta de Pagamento Cumulado Com Cobrança |          1.696 | 1.598–1.8   | 2.6e-67  |              1.2e-23  |

## Validação temporal (treino: ajuizados até 2021, n = 20684; teste: 2022 em diante, n = 17840)

- Concordance index: 0.5732 no treino, 0.5653 no teste (0,5 = ordena ao acaso).
- Sem processos suficientes no treino, tratadas como referência no teste: 8ª Vara Cível de Sorocaba, 9ª Vara Cível de Sorocaba.
- Brier integrado até 36 meses no teste: 0.1956 (Kaplan-Meier sem covariáveis: 0.2038; menor é melhor).

## Calibração no teste (probabilidade de sentença até h meses, por grupo do previsto)

### 12 meses

|   grupo |    n |   previsto |   observado |
|--------:|-----:|-----------:|------------:|
|       1 | 6621 |      0.342 |       0.217 |
|       2 | 2103 |      0.403 |       0.209 |
|       3 | 1993 |      0.429 |       0.246 |
|       4 | 2332 |      0.452 |       0.229 |
|       5 | 2083 |      0.463 |       0.342 |
|       6 | 1885 |      0.504 |       0.419 |
|       7 |  823 |      0.727 |       0.752 |

### 24 meses

|   grupo |    n |   previsto |   observado |
|--------:|-----:|-----------:|------------:|
|       1 | 6621 |      0.596 |       0.467 |
|       2 | 2103 |      0.673 |       0.481 |
|       3 | 1993 |      0.703 |       0.488 |
|       4 | 2332 |      0.728 |       0.445 |
|       5 | 2083 |      0.739 |       0.545 |
|       6 | 1885 |      0.781 |       0.583 |
|       7 |  823 |      0.928 |       0.849 |
