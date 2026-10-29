# Relatório de qualidade — snapshot 2026-10-29

Gerado por `ampulheta preparar`. Fonte: CNJ/DataJud, API Pública. Coleta em 2026-10-29T23:29:41+00:00; 38524 registros brutos.

## Regras de limpeza (contadas)

| Regra | Ocorrências |
| --- | ---: |
| flag: historico_curto | 149 |
| flag: movimento_antes_do_ajuizamento | 9 |
| movimento duplicado (mesmo código, mesmo dia) removido | 177833 |
| movimento sem código TPU ignorado | 58 |

Processos na tabela final: **38524**, dos quais 30566 com sentença (79.3%) e 7958 censurados na data do snapshot.

## Tempo até a sentença (só sentenciados; otimista, ignora censura)

mediana 398 dias, p80 778, p90 1080.

## Por vara

| vara_nome                                              |    n |   eventos |   censura_% |
|:-------------------------------------------------------|-----:|----------:|------------:|
| 01 CIVEL DE SOROCABA                                   | 5234 |      3682 |        29.7 |
| 02 CIVEL DE SOROCABA                                   | 5042 |      4155 |        17.6 |
| 03 CIVEL DE SOROCABA                                   | 5449 |      4286 |        21.3 |
| 04 CIVEL DE SOROCABA                                   | 5131 |      4205 |        18   |
| 05 CIVEL DE SOROCABA                                   | 4775 |      4090 |        14.3 |
| 06 CIVEL DE SOROCABA                                   | 4995 |      4036 |        19.2 |
| 07 CIVEL DE SOROCABA                                   | 5181 |      4351 |        16   |
| 08 CIVEL DE SOROCABA                                   | 1207 |       912 |        24.4 |
| 09 CIVEL SOROCABA                                      | 1134 |       814 |        28.2 |
| Juízo Titular I - 1ª Vara Cível da Comarca de Sorocaba |   48 |         4 |        91.7 |
| Juízo Titular I - 2ª Vara Cível da Comarca de Sorocaba |   22 |         4 |        81.8 |
| Juízo Titular I - 3ª Vara Cível da Comarca de Sorocaba |   33 |         4 |        87.9 |
| Juízo Titular I - 4ª Vara Cível da Comarca de Sorocaba |   49 |        10 |        79.6 |
| Juízo Titular I - 5ª Vara Cível da Comarca de Sorocaba |   29 |         7 |        75.9 |
| Juízo Titular I - 6ª Vara Cível da Comarca de Sorocaba |   18 |         1 |        94.4 |
| Juízo Titular I - 7ª Vara Cível da Comarca de Sorocaba |    7 |         2 |        71.4 |
| Juízo Titular I - 8ª Vara Cível da Comarca de Sorocaba |  113 |         2 |        98.2 |
| Juízo Titular I - 9ª Vara Cível da Comarca de Sorocaba |   57 |         1 |        98.2 |

## Por classe

| classe_nome                                          |     n |   eventos |   censura_% |
|:-----------------------------------------------------|------:|----------:|------------:|
| Despejo por Falta de Pagamento                       |   966 |       917 |         5.1 |
| Despejo por Falta de Pagamento Cumulado Com Cobrança |  1240 |      1123 |         9.4 |
| Procedimento Comum Cível                             | 36318 |     28526 |        21.5 |

## Por sistema de origem

| sistema   |     n |   eventos |   censura_% |
|:----------|------:|----------:|------------:|
| Projudi   |   376 |        35 |        90.7 |
| SAJ       | 38148 |     30531 |        20   |

## Por ano de ajuizamento

|   ano |    n |   eventos |
|------:|-----:|----------:|
|  2018 | 4223 |      3976 |
|  2019 | 5883 |      5513 |
|  2020 | 5361 |      4871 |
|  2021 | 5217 |      4554 |
|  2022 | 5087 |      3986 |
|  2023 | 5653 |      3460 |
|  2024 | 7100 |      4206 |

## Tipo da primeira sentença (TPU)

| tipo_sentenca                                      |   count |
|:---------------------------------------------------|--------:|
| Procedência                                        |    8711 |
| Procedência em Parte                               |    6397 |
| Improcedência                                      |    5909 |
| Homologação de Transação                           |    4657 |
| Desistência                                        |    1919 |
| Sem Resolução de Mérito                            |    1092 |
| Indeferimento da petição inicial                   |     504 |
| Não-Acolhimento de Embargos de Declaração          |     301 |
| Ausência de pressupostos processuais               |     257 |
| Extinção da execução ou do cumprimento da sentença |     176 |
| Extinção                                           |     136 |
| Pronúncia de Decadência ou Prescrição              |     108 |
| Acolhimento de Embargos de Declaração              |     108 |
| Perempção, litispendência ou coisa julgada         |      60 |
| Renúncia ao direito pelo autor                     |      48 |
