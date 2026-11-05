# Relatório do modelo — snapshot 2026-10-29

Gerado por `ampulheta modelar`. Fonte: CNJ/DataJud, API Pública.

Cox proporcional, um modelo por transição (a fase atual não entra como covariável, para evitar viés de tempo imortal), com vara, classe e assunto principal. Referências: 1ª Vara Cível de Sorocaba, Procedimento Comum Cível e outros assuntos (assuntos com menos de 1% dos processos; 30 assuntos entram como covariável). Hazard ratio > 1 = evento mais rápido que a referência. A coluna de proporcionalidade é o p do teste de Schoenfeld; p pequeno indica que o efeito muda ao longo do tempo e o hazard ratio deve ser lido como média no período.

## Ajuizamento → Sentença

Cox sobre 38524 processos (30497 com evento).

### Hazard ratios (modelo ajustado em todos os processos)

| grupo   | covariável                                            |   hazard ratio | IC 95%      |        p |   p proporcionalidade |
|:--------|:------------------------------------------------------|---------------:|:------------|---------:|----------------------:|
| vara    | 2ª Vara Cível de Sorocaba                             |          1.442 | 1.379–1.507 | 2.5e-58  |              0.0018   |
| vara    | 3ª Vara Cível de Sorocaba                             |          1.429 | 1.367–1.493 | 1.8e-56  |              2.1e-10  |
| vara    | 4ª Vara Cível de Sorocaba                             |          1.358 | 1.299–1.42  | 1e-41    |              1.9e-05  |
| vara    | 5ª Vara Cível de Sorocaba                             |          1.883 | 1.8–1.969   | 2.7e-169 |              1.6e-17  |
| vara    | 6ª Vara Cível de Sorocaba                             |          1.235 | 1.181–1.292 | 2.5e-20  |              2.1e-13  |
| vara    | 7ª Vara Cível de Sorocaba                             |          1.693 | 1.62–1.77   | 1.9e-121 |              5.7e-06  |
| vara    | 8ª Vara Cível de Sorocaba                             |          1.625 | 1.51–1.748  | 1e-38    |              9.6e-06  |
| vara    | 9ª Vara Cível de Sorocaba                             |          1.488 | 1.378–1.606 | 2.3e-24  |              4.2e-11  |
| classe  | Despejo por Falta de Pagamento                        |          4.571 | 4.08–5.122  | 4.8e-151 |              1.2e-40  |
| classe  | Despejo por Falta de Pagamento Cumulado Com Cobrança  |          1.947 | 1.749–2.167 | 3.8e-34  |              3.9e-10  |
| assunto | Indenização por Dano Material (7780)                  |          0.921 | 0.873–0.972 | 0.0026   |              2.3e-11  |
| assunto | Condomínio (10462)                                    |          2.123 | 2.018–2.234 | 2.4e-186 |              1.9e-21  |
| assunto | Práticas Abusivas (11811)                             |          1.036 | 0.979–1.098 | 0.22     |              0.00035  |
| assunto | Defeito, nulidade ou anulação (4703)                  |          0.91  | 0.858–0.964 | 0.0015   |              0.72     |
| assunto | Rescisão do contrato e devolução do dinheiro (7768)   |          0.815 | 0.765–0.869 | 4.1e-10  |              2e-08    |
| assunto | Perdas e Danos (7698)                                 |          0.949 | 0.891–1.011 | 0.11     |              0.083    |
| assunto | Prestação de Serviços (9596)                          |          1.117 | 1.05–1.189  | 0.0005   |              0.22     |
| assunto | Indenização por Dano Moral (7779)                     |          1.006 | 0.941–1.075 | 0.86     |              0.42     |
| assunto | Locação de Imóvel (9593)                              |          0.93  | 0.841–1.028 | 0.15     |              0.078    |
| assunto | Seguro (9597)                                         |          0.932 | 0.873–0.996 | 0.038    |              3.8e-108 |
| assunto | Inclusão Indevida em Cadastro de Inadimplentes (6226) |          1.668 | 1.557–1.787 | 9.2e-48  |              0.051    |
| assunto | Auxílio-Acidente (Art. 86) (6107)                     |          0.74  | 0.687–0.798 | 4.5e-15  |              5e-43    |
| assunto | Estabelecimentos de Ensino (7620)                     |          1.118 | 1.039–1.204 | 0.003    |              0.17     |
| assunto | Interpretação / Revisão de Contrato (7770)            |          2.156 | 2.007–2.316 | 8.4e-98  |              0.2      |
| assunto | Contratos Bancários (9607)                            |          1.044 | 0.963–1.131 | 0.3      |              0.016    |
| assunto | Inadimplemento (7691)                                 |          0.928 | 0.827–1.042 | 0.21     |              2.4e-05  |
| assunto | Prescrição e Decadência (5632)                        |          0.222 | 0.189–0.26  | 1.3e-76  |              5.3e-21  |
| assunto | Cobrança de Aluguéis - Sem despejo (11000)            |          0.752 | 0.687–0.823 | 7.8e-10  |              7.8e-11  |
| assunto | Rescisão / Resolução (10582)                          |          0.82  | 0.749–0.896 | 1.3e-05  |              0.93     |
| assunto | Direitos / Deveres do Condômino (10468)               |          1.887 | 1.736–2.051 | 1.8e-50  |              0.00016  |
| assunto | Despejo por Inadimplemento (14915)                    |          0.775 | 0.679–0.885 | 0.00016  |              0.32     |
| assunto | Indenização por Dano Moral (10433)                    |          0.839 | 0.761–0.924 | 0.00039  |              0.058    |
| assunto | Cláusulas Abusivas (11974)                            |          1.556 | 1.413–1.714 | 3.2e-19  |              0.14     |
| assunto | Compra e Venda (9587)                                 |          0.961 | 0.869–1.062 | 0.43     |              0.3      |
| assunto | Empréstimo consignado (11806)                         |          1.345 | 1.215–1.489 | 1.1e-08  |              0.016    |
| assunto | Adjudicação Compulsória (10450)                       |          0.844 | 0.755–0.943 | 0.0028   |              0.0021   |
| assunto | Bancários (7752)                                      |          1.221 | 1.095–1.362 | 0.00034  |              0.53     |
| assunto | DIREITO PROCESSUAL CIVIL E DO TRABALHO (8826)         |          0.647 | 0.572–0.732 | 4.4e-12  |              0.037    |
| assunto | Pagamento (7703)                                      |          1.213 | 1.088–1.352 | 0.00049  |              0.00097  |
| assunto | Indenização por Dano Material (10439)                 |          0.85  | 0.759–0.952 | 0.0051   |              0.15     |

### Validação temporal (treino: ajuizados até 2021, n = 20684; teste: 2022 em diante, n = 17840)

- Concordance index: 0.6213 no treino, 0.5828 no teste (0,5 = ordena ao acaso).
- Sem processos suficientes no treino, tratadas como referência no teste: 8ª Vara Cível de Sorocaba, 9ª Vara Cível de Sorocaba, Despejo por Inadimplemento (14915), DIREITO PROCESSUAL CIVIL E DO TRABALHO (8826).
- Brier integrado até 36 meses no teste: 0.1957 (Kaplan-Meier sem covariáveis: 0.2038; menor é melhor).

### Calibração no teste (probabilidade do evento até h meses, por grupo do previsto)

12 meses:

|   grupo |    n |   previsto |   observado |
|--------:|-----:|-----------:|------------:|
|       1 | 1989 |      0.271 |       0.148 |
|       2 | 1628 |      0.312 |       0.209 |
|       3 | 1751 |      0.333 |       0.19  |
|       4 | 1844 |      0.369 |       0.199 |
|       5 | 1731 |      0.398 |       0.239 |
|       6 | 2048 |      0.426 |       0.27  |
|       7 | 1560 |      0.45  |       0.317 |
|       8 | 1746 |      0.486 |       0.296 |
|       9 | 1803 |      0.551 |       0.362 |
|      10 | 1740 |      0.697 |       0.606 |

24 meses:

|   grupo |    n |   previsto |   observado |
|--------:|-----:|-----------:|------------:|
|       1 | 1989 |      0.507 |       0.416 |
|       2 | 1628 |      0.566 |       0.466 |
|       3 | 1751 |      0.596 |       0.431 |
|       4 | 1844 |      0.643 |       0.458 |
|       5 | 1731 |      0.678 |       0.481 |
|       6 | 2048 |      0.711 |       0.477 |
|       7 | 1560 |      0.738 |       0.533 |
|       8 | 1746 |      0.774 |       0.504 |
|       9 | 1803 |      0.832 |       0.598 |
|      10 | 1740 |      0.923 |       0.724 |

## Audiência → Sentença

Cox sobre 2957 processos (2765 com evento).

### Hazard ratios (modelo ajustado em todos os processos)

| grupo   | covariável                                            |   hazard ratio | IC 95%      |       p |   p proporcionalidade |
|:--------|:------------------------------------------------------|---------------:|:------------|--------:|----------------------:|
| vara    | 2ª Vara Cível de Sorocaba                             |          1.163 | 0.958–1.412 | 0.13    |               0.27    |
| vara    | 3ª Vara Cível de Sorocaba                             |          1.379 | 1.122–1.694 | 0.0023  |               0.69    |
| vara    | 4ª Vara Cível de Sorocaba                             |          1.088 | 0.892–1.327 | 0.41    |               0.46    |
| vara    | 5ª Vara Cível de Sorocaba                             |          2.295 | 1.889–2.789 | 6.4e-17 |               0.95    |
| vara    | 6ª Vara Cível de Sorocaba                             |          1.098 | 0.897–1.344 | 0.36    |               0.81    |
| vara    | 7ª Vara Cível de Sorocaba                             |          1.476 | 1.233–1.765 | 2.1e-05 |               0.53    |
| vara    | 8ª Vara Cível de Sorocaba                             |          1.592 | 1.204–2.105 | 0.0011  |               0.63    |
| assunto | Indenização por Dano Material (7780)                  |          1.093 | 0.917–1.302 | 0.32    |               0.31    |
| assunto | Condomínio (10462)                                    |          1.184 | 1.042–1.345 | 0.0097  |               0.14    |
| assunto | Práticas Abusivas (11811)                             |          1.287 | 0.926–1.786 | 0.13    |               0.19    |
| assunto | Defeito, nulidade ou anulação (4703)                  |          1.086 | 0.861–1.369 | 0.49    |               0.071   |
| assunto | Rescisão do contrato e devolução do dinheiro (7768)   |          0.966 | 0.76–1.227  | 0.78    |               0.46    |
| assunto | Perdas e Danos (7698)                                 |          0.724 | 0.595–0.882 | 0.0014  |               0.38    |
| assunto | Prestação de Serviços (9596)                          |          0.754 | 0.666–0.853 | 7.5e-06 |               7.3e-07 |
| assunto | Indenização por Dano Moral (7779)                     |          1.387 | 1.13–1.703  | 0.0018  |               0.48    |
| assunto | Locação de Imóvel (9593)                              |          1.069 | 0.744–1.535 | 0.72    |               0.34    |
| assunto | Inclusão Indevida em Cadastro de Inadimplentes (6226) |          2.039 | 1.544–2.691 | 5e-07   |               0.07    |
| assunto | Estabelecimentos de Ensino (7620)                     |          0.664 | 0.555–0.794 | 7.5e-06 |               0.00067 |
| assunto | Cobrança de Aluguéis - Sem despejo (11000)            |          0.849 | 0.63–1.144  | 0.28    |               0.63    |
| assunto | Rescisão / Resolução (10582)                          |          0.915 | 0.696–1.204 | 0.53    |               0.82    |
| assunto | Direitos / Deveres do Condômino (10468)               |          1.321 | 1.099–1.589 | 0.0031  |               0.29    |
| assunto | Indenização por Dano Moral (10433)                    |          1.005 | 0.787–1.283 | 0.97    |               0.73    |
| assunto | Compra e Venda (9587)                                 |          0.927 | 0.662–1.3   | 0.66    |               0.47    |
| assunto | Pagamento (7703)                                      |          0.934 | 0.693–1.258 | 0.65    |               0.45    |
| assunto | Indenização por Dano Material (10439)                 |          0.743 | 0.537–1.028 | 0.073   |               0.27    |

### Validação temporal (treino: ajuizados até 2021, n = 2561; teste: 2022 em diante, n = 396)

- Concordance index: 0.5932 no treino, 0.5887 no teste (0,5 = ordena ao acaso).
- Sem processos suficientes no treino, tratadas como referência no teste: 8ª Vara Cível de Sorocaba, 9ª Vara Cível de Sorocaba, Despejo por Falta de Pagamento, Despejo por Falta de Pagamento Cumulado Com Cobrança, Práticas Abusivas (11811), Seguro (9597), Auxílio-Acidente (Art. 86) (6107), Interpretação / Revisão de Contrato (7770), Contratos Bancários (9607), Inadimplemento (7691), Prescrição e Decadência (5632), Despejo por Inadimplemento (14915), Cláusulas Abusivas (11974), Empréstimo consignado (11806), Adjudicação Compulsória (10450), Bancários (7752), DIREITO PROCESSUAL CIVIL E DO TRABALHO (8826).
- Brier integrado até 36 meses no teste: 0.1253 (Kaplan-Meier sem covariáveis: 0.1356; menor é melhor).

### Calibração no teste (probabilidade do evento até h meses, por grupo do previsto)

12 meses:

|   grupo |   n |   previsto |   observado |
|--------:|----:|-----------:|------------:|
|       1 |  46 |      0.438 |       0.677 |
|       2 |  58 |      0.504 |       0.561 |
|       3 |  16 |      0.512 |       0.708 |
|       4 |  47 |      0.55  |       0.745 |
|       5 |  31 |      0.578 |       0.629 |
|       6 |  63 |      0.627 |       0.628 |
|       7 |  23 |      0.651 |       0.765 |
|       8 |  85 |      0.754 |       0.937 |
|       9 |  27 |      0.786 |       0.92  |

24 meses:

|   grupo |   n |   previsto |   observado |
|--------:|----:|-----------:|------------:|
|       1 |  46 |      0.673 |       0.853 |
|       2 |  58 |      0.745 |       0.714 |
|       3 |  16 |      0.752 |       1     |
|       4 |  47 |      0.789 |       0.913 |
|       5 |  31 |      0.813 |       0.675 |
|       6 |  63 |      0.854 |       0.785 |
|       7 |  23 |      0.871 |       0.883 |
|       8 |  85 |      0.934 |       0.937 |
|       9 |  27 |      0.949 |       0.92  |

## Comparação de camadas (teste temporal)

Mesmo treino (ajuizados até 2021) e mesmo teste para as três. Kaplan-Meier não usa covariáveis, então ordena ao acaso (c-index 0,5). Brier integrado até 36 meses; erro de calibração = diferença média entre observado e previsto nos grupos, ponderada pelo n. Boosting com perda de Cox, 100 árvores de profundidade 3, taxa 0.1, subamostra 0.8, parâmetros fixos sem busca; serve só para comparação e não publica curvas.

| transição              | camada       |   c-index |   Brier integrado | erro de calibração 12 m   | erro de calibração 24 m   |
|:-----------------------|:-------------|----------:|------------------:|:--------------------------|:--------------------------|
| Ajuizamento → Sentença | Kaplan-Meier |    0.5    |            0.2038 | —                         | —                         |
| Ajuizamento → Sentença | Cox          |    0.5828 |            0.1957 | 0.146                     | 0.188                     |
| Ajuizamento → Sentença | Boosting     |    0.5918 |            0.1938 | 0.145                     | 0.188                     |
| Audiência → Sentença   | Kaplan-Meier |    0.5    |            0.1356 | —                         | —                         |
| Audiência → Sentença   | Cox          |    0.5887 |            0.1253 | 0.126                     | 0.075                     |
| Audiência → Sentença   | Boosting     |    0.5813 |            0.12   | 0.105                     | 0.046                     |

Importância das variáveis no boosting (redução de perda, somada por grupo):

| transição              |   vara |   classe |   assunto |
|:-----------------------|-------:|---------:|----------:|
| Ajuizamento → Sentença | 0.2711 |   0.1897 |    0.5392 |
| Audiência → Sentença   | 0.3983 |   0.0278 |    0.5739 |
