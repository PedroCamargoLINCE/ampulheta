# Ampulheta — Plano do projeto

Oct 28, 2026 · @Maria

## O nome: Ampulheta

Ampulheta é a ferramenta que responde "quanto tempo esse processo ainda vai levar?" usando só dados públicos do CNJ e estatística clássica, sem LLM e sem serviço pago.

Por que esse nome: uma ampulheta mede tempo que já passou e tempo que ainda falta. É exatamente a pergunta do projeto, vista dos dois lados. A palavra é curta, portuguesa, fácil de lembrar e não existe como produto jurídico conhecido. Nome do pacote Python: `ampulheta`. Linha de comando: `ampulheta coletar`, `ampulheta preparar`, `ampulheta modelar`, `ampulheta publicar`.

Alternativas consideradas, caso o nome não agrade: **Clepsidra** (relógio de água dos tribunais romanos; bonito, mas pouca gente conhece), **Tramita** (direto, mas genérico) e **Quanto Falta** (claro, mas difícil de usar como nome de pacote).

## O problema em uma frase

Dado um processo (vara, classe, assunto, data de distribuição e, opcionalmente, há quanto tempo tramita), estimar a **distribuição do tempo até a sentença**, com incerteza honesta, e não um número único.

Quem usa: advogado conversando com cliente ("na 3ª Vara Cível de Sorocaba, despejo tem mediana de X meses, 80% resolvido em Y"), escritório precificando honorários de êxito e provisionando caixa, pesquisador comparando varas e tribunais.

## Por que é sobrevivência, não regressão

Calcular a média de tempo até sentença direto do DataJud dá um resultado otimista, porque só entram processos já julgados. Os lentos, ainda abertos, ficam de fora. Esse é o viés de censura.

Análise de sobrevivência usa os dois grupos: quem foi sentenciado tem o evento observado; quem está aberto contribui com "sobreviveu sem sentença pelo menos até a data do snapshot" (censura à direita). O modelo aprende com ambos.

| Termo | No Ampulheta |
| --- | --- |
| Tempo zero | `dataAjuizamento` |
| Evento | primeiro movimento da família *Julgamento* (TPU 193 e filhos) |
| Censura | processo sem evento até a data do snapshot |
| Função de sobrevivência S(t) | P(ainda sem sentença após t meses) |
| Sobrevivência condicional | P(sentença nos próximos 6 meses, dado que já tramita há 8) |

## Arquitetura: três estágios desacoplados

Regra de ouro: **cada estágio lê só o arquivo do anterior.** O modelo nunca chama a API. Quem clona o repositório começa no estágio 2 ou 3 usando o Parquet versionado, sem internet e sem chave.

&#91;embedded content: pipeline do Ampulheta · 3 estágios\]

A API só é tocada pelo estágio 1; o Parquet versionado no git é o ponto de entrada de quem reproduz o trabalho.

### Estágio 1: Coleta (`coletor.py`)

Entrada: `config.yaml` com tribunal, grau, códigos de classe, códigos das varas e intervalo de ajuizamento. Saída: a pasta `raw/<data-do-snapshot>/`, imutável.

1. Monta a query Elasticsearch com os filtros do config.
2. Pagina com `search_after` e `sort` em `@timestamp`, `size` 1000.
3. Grava cada página na hora em `raw/<snapshot>/tjsp/<vara>/<página>.jsonl`; se a API cair, retoma de onde parou.
4. Retry com backoff exponencial em 429 e 504; respeita 120 requisições por minuto.
5. Escreve `manifest.json` com data/hora da coleta, filtros, total de registros e hash dos arquivos.

A data do snapshot é a data de censura de todo processo ainda aberto. Uma coleta nova vira outra pasta; nada é sobrescrito.

### Estágio 2: Preparo (`preparo.py`)

Transforma o JSON aninhado em duas tabelas Parquet.

`processos.parquet`, uma linha por processo:

| Coluna | Origem |
| --- | --- |
| numero\_processo | `numeroProcesso` |
| vara\_codigo, vara\_nome | `orgaoJulgador` |
| classe\_codigo, assunto\_principal | `classe`, `assuntos[0]` |
| data\_ajuizamento | `dataAjuizamento` |
| data\_evento | menor `dataHora` entre movimentos da família 193 |
| data\_censura | data do snapshot |
| tempo\_dias | (data\_evento ou data\_censura) − data\_ajuizamento |
| evento | 1 se sentenciado, 0 se censurado |
| tipo\_sentenca | procedente, improcedente, parcial, extinção |

`eventos.parquet`, uma linha por movimento (formato longo), guardado para modelar outros eventos depois: trânsito em julgado, baixa, primeiro despacho.

Regras de limpeza, cada uma documentada e contada:

- `dataAjuizamento` antes de 1990 ou depois da coleta: descarta e conta.
- Sentença antes do ajuizamento: descarta e conta.
- Movimentos duplicados (mesmo código, mesmo dia): deduplica.
- Processo com menos de 2 movimentos: provável migração com histórico truncado; recebe flag.
- Vara que mudou de código no período: tabela de equivalência manual.

O estágio gera `relatorio_qualidade.md` automaticamente: quantos processos entraram, quantos saíram por qual regra, taxa de censura por vara. Vai direto para o README.

### Estágio 3: Modelagem (`modelo.py`) e publicação (`publicar.py`)

Em camadas; cada camada é um resultado publicável por si só.

1. **Descritivo (Kaplan-Meier).** Curva S(t) por vara, classe e ano de ajuizamento, com intervalo de confiança e teste log-rank entre varas. Sem hiperparâmetro. Já responde "a 3ª Vara é mais lenta que a 2ª?".
2. **Cox proporcional.** Hazard ratio por covariável, interpretável em tabela ("despejo julga 1,8× mais rápido que procedimento comum"). Checa a hipótese de proporcionalidade; onde falhar, vira conteúdo.
3. **Gradient boosting de sobrevivência** (`scikit-survival` ou `lifelines`). Captura interações vara × assunto. Validação temporal: treina em ajuizados até 2021, testa em 2022 em diante, porque o uso real é prever processos novos.

Métricas, sempre com validação temporal: concordance index (ordena bem quem é mais rápido?), Brier score integrado (probabilidade calibrada ao longo do tempo?) e calibração do quantil (quando o modelo diz "80% em 18 meses", 80% realmente foram?).

`publicar.py` gera JSON pré-computado (curvas e quantis por vara e classe) e um site estático em `site/`, HTML e JS puros, hospedável no GitHub Pages. Duas telas:

- **Explorar**: escolhe vara e classe; vê curva, mediana, p80, p90 e tamanho da amostra.
- **Meu processo**: informa vara, classe e há quantos meses tramita; recebe a probabilidade de sentença nos próximos 3, 6 e 12 meses, calculada no navegador a partir do JSON.

Rodapé obrigatório: citação ao CNJ/DataJud como fonte e data do snapshot.

## Estrutura do repositório

```
ampulheta/
├── README.md               problema, método, resultados, limitações
├── config.yaml
├── pyproject.toml
├── src/ampulheta/
│   ├── coletor.py
│   ├── preparo.py
│   ├── modelo.py
│   └── publicar.py
├── raw/                    gitignored (grande); manifest.json versionado
├── data/
│   ├── processos.parquet   versionado: é a reprodutibilidade
│   ├── eventos.parquet
│   └── relatorio_qualidade.md
├── models/
├── notebooks/              exploração, um notebook por pergunta
├── site/                   estático, GitHub Pages
└── tests/                  limpeza e contagem de tempo têm teste
```

## Ordem de execução

Seis passos, cerca de duas semanas de trabalho em meio período. O passo 3 já entrega algo publicável.

1. **Prova de vida** (1 dia). Coletar uma vara, uma classe, cerca de 2 mil processos. Olhar os movimentos na mão. Confirmar na TPU quais códigos significam sentença de fato.
2. **ETL completo** (2 a 3 dias). Recorte escolhido inteiro, mais o relatório de qualidade.
3. **Kaplan-Meier por vara** (2 dias). Primeira versão do site só com isso.
4. **Cox** (3 dias). Validação temporal e gráficos de calibração.
5. **Boosting** (3 dias). Comparação com Cox e a tela "meu processo".
6. **README final** (1 dia). Resultados e limitações.

Recorte da v1: TJSP, 1º grau, uma ou poucas comarcas (Sorocaba, Campinas), duas ou três classes com fim bem definido (Procedimento Comum Cível, Despejo por falta de pagamento), ajuizados entre 2018 e 2024.

## Decisões já tomadas e por quê

- **Sem LLM, sem serviço externo.** Reprodutível por qualquer pessoa com Python; no estágio 3 nem internet precisa.
- **Snapshot versionado no git.** A API é instável; o dado congelado é o produto.
- **Recorte pequeno, uma comarca.** A técnica é a mesma para 10 ou 100 varas; profundidade antes de largura.
- **Validação temporal.** O uso real é prever o futuro; split aleatório mentiria.
- **Site estático.** Zero custo, zero manutenção, demonstrável com um link.

## Limitações declaradas desde o início

- "Sentença" é o fim do 1º grau, não do processo; recurso pode dobrar o tempo. A v2 modela trânsito em julgado.
- Os dados dependem do que cada tribunal envia ao CNJ. TJSP é bom; outros nem tanto.
- O modelo descreve o passado. Mudança de juiz, de sistema ou de lei quebra a previsão; por isso o site mostra a data do snapshot.
- Não substitui advogado. Serve para conversa com cliente, provisionamento e pesquisa.

## Trabalhos relacionados e posicionamento

Não existe hoje, aberta ou fechada, uma ferramenta que modele o tempo de tramitação com análise de sobrevivência e entregue previsão condicional calibrada. O mercado está ocupado em cima (SaaS de jurimetria com dashboards de média, metodologia fechada) e embaixo (TCCs e dissertações sem ferramenta reutilizável). O Ampulheta ocupa o meio: **o primeiro modelo de sobrevivência para tempo de tramitação que é aberto, reproduzível e calibrado, sobre dados públicos.**

| Ferramenta | O que é | Licença | Prevê tempo? |
| --- | --- | --- | --- |
| [nanojud](https://pypi.org/project/nanojud/0.5.0/) | Toolkit Python: consulta por número CNJ no eSAJ, DataJud e DJEN; timeline consolidada; CLI e MCP; engenharia sólida (CI, 90% de cobertura, mypy) | MIT | Não; consulta processo a processo, sem busca em lote nem agregação |
| [pydatajud](https://pypi.org/project/pydatajud/) | Cliente Python mínimo: número CNJ → movimentações | Aberta | Não |
| [cnj-processual](https://glama.ai/mcp/servers/ACARVALHOSP/cnj-processual) | Servidor MCP com DataJud e DJEN para agentes de IA | MIT | Não |
| [LexisPredict](https://github.com/W1CAPITAL/LexisPredict) | Gestão de escritório (carteira, prazos, WhatsApp, CRM) com scanner DataJud/DJEN; o "Predict" é só nome | Proprietária, repo público | Não; nenhuma estatística |
| [Apify DataJud Scraper](https://api.apify.com/v2/actors/MefFnqs11geMALMGy/builds/bOZMNmNgMkfeTNtgF/openapi.json) | Scraper pago com filtros por classe, vara e data de ajuizamento | Paga | Não |
| [Judit](https://judit.io/blog/artigos/datajud-cnj-api-publica-x-privada-comparacao/), [Turivius](https://turivius.com/portal/creditos-judiciais-e-jurimetria-na-precificacao-de-ativos-judiciais/?amp=1) | Plataformas comerciais de jurimetria; tempo médio por juiz, busca por CPF/OAB | Paga, fechada | Médias em dashboard, sem metodologia aberta |
| [ABJ](https://github.com/abjur/ambientalCNJ) | Associação Brasileira de Jurimetria: estudos reproduzíveis em R sobre DataJud | Aberta | Análises pontuais por relatório, não ferramenta |
| [UnB, dissertação 2025](https://www.repositorio.unb.br/bitstream/10482/52609/1/RafaelMonteiroDeCastroNascimento_DISSERT.pdf) | Sobrevivência aplicada à fase de precatórios; conclui que o tempo já decorrido é a variável mais importante | Acadêmica | Sim, mas sem código reutilizável |

Consequências para o plano:

- A coleta é commodity. O `coletor.py` pode usar `nanojud` ou `pydatajud` como dependência, ou ficar em \~150 linhas próprias; o que nenhum deles faz é busca em lote por vara e classe, que é o que o Ampulheta precisa.
- O valor está depois da coleta: Parquet versionado, limpeza documentada, modelo de sobrevivência, calibração. Esse trecho não existe em lugar nenhum.
- O README ganha uma seção curta "Trabalhos relacionados" com esta tabela, citando a ABJ e a dissertação da UnB como referências metodológicas.
- A conclusão da UnB (tempo decorrido é a variável essencial) valida a tela "meu processo" como funcionalidade central, não acessória.

## Referências sobre a API DataJud

Fatos que o código assume, com a página de origem. Verificar a chave vigente antes da primeira coleta.

| Fato | Fonte |
| --- | --- |
| Autenticação por chave pública única, publicada pelo CNJ, no header `Authorization: APIKey <chave>`; pode mudar a qualquer momento | [TJDFT](https://www.tjdft.jus.br/transparencia/tecnologia-da-informacao-e-comunicacao/dados-abertos/datajud-tjdft) |
| Um endpoint por tribunal, via POST: `api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search` | [Dev.to, L. Vilela](https://dev.to/leonardo_vilela/construindo-algoritmo-para-consumir-a-api-publica-do-cnj-conselho-nacional-de-justica-1a-parte-3n4i) |
| Corpo em Elasticsearch Query DSL; `size` de 10 a 10000; paginação por `search_after` com `sort` em `@timestamp` | [Tutorial oficial (PDF)](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf) |
| Campos: `numeroProcesso`, `tribunal`, `grau`, `classe`, `assuntos`, `orgaoJulgador` (código, nome, município IBGE), `dataAjuizamento`, `movimentos` (código, nome, dataHora, complementos) | [Guia de campos](https://github.com/alexmmatos/arthur-mcp/wiki/pt-BR-Como-Integrar-DataJud-Usando-MCP) |
| Nomes de partes não são expostos | [cnj-processual](https://glama.ai/mcp/servers/ACARVALHOSP/cnj-processual) |
| Limite de 120 requisições por minuto (termo de uso) | [TabNews](https://www.tabnews.com.br/leonardomv/projeto-php-para-utilizacao-da-api-do-cnj) |
| API lenta e instável: respostas de \~48 s, HTTP 504 e 429 em pico | [cnj-processual, notas](https://glama.ai/mcp/servers/ACARVALHOSP/cnj-processual/tree) |
| Citação ao CNJ e ao DataJud é obrigatória em qualquer publicação ou painel | [Portaria CNJ (2026)](https://atos.cnj.jus.br/files/original144713202608196a85c1f168ce3.pdf) |

Documentação oficial: [datajud-wiki.cnj.jus.br/api-publica](https://datajud-wiki.cnj.jus.br/api-publica/).
