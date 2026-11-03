# Relatório de qualidade — snapshot 2026-10-29

Gerado por `ampulheta preparar`. Fonte: CNJ/DataJud, API Pública. Coleta em 2026-10-29T23:29:41+00:00; 38524 registros brutos.

## Regras de limpeza (contadas)

| Regra | Ocorrências |
| --- | ---: |
| flag: historico_curto | 149 |
| flag: movimento_antes_do_ajuizamento | 9 |
| flag: sistema_sem_julgamento | 376 |
| movimento duplicado (mesmo código, mesmo dia) removido | 177833 |
| movimento sem código TPU ignorado | 58 |

Processos na tabela final: **38524**, dos quais 30497 com sentença (79.2%) e 8027 censurados na data do snapshot.

## Tempo até a sentença (só sentenciados; otimista, ignora censura)

mediana 404 dias, p80 788, p90 1093.

## Por vara

| vara_nome                                              |    n |   eventos |   censura_% |
|:-------------------------------------------------------|-----:|----------:|------------:|
| 01 CIVEL DE SOROCABA                                   | 5234 |      3668 |        29.9 |
| 02 CIVEL DE SOROCABA                                   | 5042 |      4147 |        17.8 |
| 03 CIVEL DE SOROCABA                                   | 5449 |      4274 |        21.6 |
| 04 CIVEL DE SOROCABA                                   | 5131 |      4197 |        18.2 |
| 05 CIVEL DE SOROCABA                                   | 4775 |      4085 |        14.5 |
| 06 CIVEL DE SOROCABA                                   | 4995 |      4019 |        19.5 |
| 07 CIVEL DE SOROCABA                                   | 5181 |      4347 |        16.1 |
| 08 CIVEL DE SOROCABA                                   | 1207 |       912 |        24.4 |
| 09 CIVEL SOROCABA                                      | 1134 |       814 |        28.2 |
| Juízo Titular I - 1ª Vara Cível da Comarca de Sorocaba |   48 |         4 |        91.7 |
| Juízo Titular I - 2ª Vara Cível da Comarca de Sorocaba |   22 |         4 |        81.8 |
| Juízo Titular I - 3ª Vara Cível da Comarca de Sorocaba |   33 |         4 |        87.9 |
| Juízo Titular I - 4ª Vara Cível da Comarca de Sorocaba |   49 |        10 |        79.6 |
| Juízo Titular I - 5ª Vara Cível da Comarca de Sorocaba |   29 |         6 |        79.3 |
| Juízo Titular I - 6ª Vara Cível da Comarca de Sorocaba |   18 |         1 |        94.4 |
| Juízo Titular I - 7ª Vara Cível da Comarca de Sorocaba |    7 |         2 |        71.4 |
| Juízo Titular I - 8ª Vara Cível da Comarca de Sorocaba |  113 |         2 |        98.2 |
| Juízo Titular I - 9ª Vara Cível da Comarca de Sorocaba |   57 |         1 |        98.2 |

## Por classe

| classe_nome                                          |     n |   eventos |   censura_% |
|:-----------------------------------------------------|------:|----------:|------------:|
| Despejo por Falta de Pagamento                       |   966 |       917 |         5.1 |
| Despejo por Falta de Pagamento Cumulado Com Cobrança |  1240 |      1121 |         9.6 |
| Procedimento Comum Cível                             | 36318 |     28459 |        21.6 |

## Por sistema de origem

| sistema   |     n |   eventos |   censura_% |
|:----------|------:|----------:|------------:|
| Projudi   |   376 |        34 |        91   |
| SAJ       | 38148 |     30463 |        20.1 |

## Por ano de ajuizamento

|   ano |    n |   eventos |
|------:|-----:|----------:|
|  2018 | 4223 |      3962 |
|  2019 | 5883 |      5504 |
|  2020 | 5361 |      4853 |
|  2021 | 5217 |      4543 |
|  2022 | 5087 |      3972 |
|  2023 | 5653 |      3458 |
|  2024 | 7100 |      4205 |

## Tipo da primeira sentença (TPU)

| tipo_sentenca                                      |   count |
|:---------------------------------------------------|--------:|
| Procedência                                        |    8807 |
| Procedência em Parte                               |    6495 |
| Improcedência                                      |    5988 |
| Homologação de Transação                           |    4710 |
| Desistência                                        |    1938 |
| Sem Resolução de Mérito                            |    1105 |
| Indeferimento da petição inicial                   |     504 |
| Ausência de pressupostos processuais               |     259 |
| Extinção da execução ou do cumprimento da sentença |     179 |
| Extinção                                           |     136 |
| Pronúncia de Decadência ou Prescrição              |     108 |
| Perempção, litispendência ou coisa julgada         |      60 |
| Renúncia ao direito pelo autor                     |      48 |
| Perda do objeto                                    |      44 |
| Procedência do Pedido - Reconhecimento pelo réu    |      23 |
