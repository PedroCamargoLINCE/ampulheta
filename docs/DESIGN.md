# Ampulheta — Design system

Versão 0.1 · 3 de novembro de 2026

## 1. Papel deste documento

Este é o guia de decisões para a interface do Ampulheta. Define como organizar telas, escrever textos, apresentar estimativas e reutilizar elementos visuais. Deve orientar pessoas e agentes de desenvolvimento.

O documento não altera o site sozinho. O sistema se concretiza nos tokens CSS, componentes, telas e verificações que implementam estas regras.

Status: direção proposta para implementação incremental, baseada na leitura do repositório. Não representa uma auditoria visual nem certificação de acessibilidade. Os valores visuais iniciais devem ser verificados na interface renderizada.

## 2. Produto e públicos

O Ampulheta estima a distribuição do tempo até a sentença em primeiro grau, usando análise de sobrevivência sobre dados públicos. A interface deve deixar explícitos tribunal, grau, cobertura e data de atualização realmente disponíveis.

Públicos: cidadãos que querem entender o tempo de espera e advogados que precisam consultar e comparar recortes históricos.

Pergunta principal: “Dado que o processo já tramita há algum tempo sem sentença, qual é a estimativa para os próximos meses?”

A estimativa não prevê o conteúdo da decisão, vitória, indenização, encerramento definitivo ou tempo de recursos. O evento exibido deve corresponder exatamente à definição utilizada pelo pipeline.

## 3. Princípios, em ordem de prioridade

1. **Interpretação correta.** A pessoa deve conseguir explicar o resultado com suas próprias palavras.
2. **Incerteza visível.** Probabilidade e intervalo disponível aparecem juntos; limitações essenciais não ficam apenas no rodapé.
3. **Tarefa antes de metodologia.** Primeiro ajudar a informar o contexto e entender o resultado; depois oferecer aprofundamento.
4. **Consistência.** Mesmo significado recebe o mesmo nome, cor e comportamento em todo o produto.
5. **Acesso amplo.** A experiência deve funcionar no celular, por teclado e com tecnologia assistiva.
6. **Simplicidade de manutenção.** Aproveitar TypeScript, Vite, CSS e componentes existentes. Uma mudança visual não exige migração de framework.

Em conflitos, preservar significado e acessibilidade antes de reduzir espaço ou acrescentar decoração.

## 4. Navegação e jornada principal

Navegação: **Estimar tempo** como entrada padrão e **Explorar dados** como tarefa secundária. Metodologia pode começar como seção expansível, sem exigir outra página.

### Estimar tempo

1. Explicar em uma frase o que será estimado e mostrar a cobertura disponível.
2. Pedir vara, classe e tempo desde o ajuizamento, confirmando que ainda não houve sentença.
3. Exibir o botão **Calcular estimativa**.
4. Mostrar o resultado associado ao contexto informado.

Não preencher silenciosamente primeira vara, primeira classe e 12 meses como se fossem dados do usuário. Exemplos devem ser identificados e ativados explicitamente.

Usar rótulos permanentes. Cada campo pode ter uma ajuda curta sobre onde encontrar a informação. “Classe processual” deve ter uma explicação em linguagem comum. Não converter automaticamente uma descrição leiga em classe jurídica sem uma correspondência validada.

Quando disponíveis, “Todas as varas” e “Todas as classes” são agregações explícitas, não substitutos silenciosos para dados desconhecidos. Informar que representam um conjunto mais amplo.

Ao editar campos após calcular, marcar o resultado como referente à seleção anterior e pedir novo cálculo, ou ocultá-lo até recalcular. Nunca mostrar números antigos sob novos rótulos.

### Hierarquia do resultado

1. Contexto: recorte selecionado e tempo já transcorrido.
2. Probabilidades de sentença nos próximos 3, 6 e 12 meses, com igual hierarquia entre os horizontes.
3. Intervalo de confiança disponível junto de cada probabilidade e explicação curta.
4. Resumo textual de prazo, apenas quando estimável.
5. Gráfico com eixo de tempo restante claramente identificado.
6. Base utilizada, atualização, limitações e metodologia expansível.

### Explorar dados

Mostrar uma curva inicialmente. A comparação é opcional e revela seus controles quando ativada. Identificar os filtros de cada série perto da legenda. Preservar comparação por classe quando possível e avisar quando os recortes diferem.

Não apresentar uma curva como ranking de qualidade de varas. Diferenças observadas podem refletir composição de processos e outros fatores.

## 5. Regras para comunicar estimativas

- Usar “Probabilidade estimada de sentença nos próximos 6 meses”, com o contexto de que o processo permanece sem sentença até o tempo informado.
- Distinguir **tempo desde o ajuizamento** e **tempo adicional a partir do momento informado**. Não misturar eixos ou unidades.
- Preferir “Com base em processos deste recorte” a “Processos como o seu”: vara e classe não capturam todas as características individuais.
- Não transformar probabilidade em data garantida. Evitar “Sua sentença sairá em...”.
- Não confundir chance de sentença com chance de ganhar o processo.
- Usar “Intervalo de confiança de 95%” com ajuda acessível: ele expressa incerteza estatística da estimativa sob as hipóteses do método; não é uma garantia individual nem cobre todas as mudanças futuras.
- Se não houver intervalo calculável, explicar isso. Não inventar faixas, confiança ou precisão.
- Se a mediana ou outro quantil não for atingido: **“Não foi possível estimar esse prazo dentro do período observado.”** Não afirmar que o evento ocorreu depois da janela observada.
- Distinguir zero estimado, valor indisponível e dado ausente. Usar texto explicativo, não apenas “—”.
- Não usar a sobreposição de intervalos como teste conclusivo de diferença entre curvas. Qualquer inferência formal exige método apropriado.
- Não chamar uma vara de “mais eficiente” com base apenas na curva de duração.
- Não apresentar o tamanho total da amostra como número de casos ainda em risco no tempo informado. Mostrar este último somente se disponível no contrato.
- Não tratar S(t) baixo como contagem de casos: qualquer regra baseada nisso deve ser descrita como sinal de instabilidade, não número observado.
- Não alterar cálculos, interpolação, horizonte ou limiares de publicação para deixar o resultado visualmente mais agradável.

Formato: português brasileiro, vírgula decimal e unidades explícitas. Percentuais devem manter precisão consistente; não transformar valores positivos pequenos em “0%” sem esclarecer o arredondamento. Números ilustrativos nunca devem aparecer como resultados reais.

## 6. Linguagem

Tom: direto, respeitoso e tranquilo. Explicar sem pressupor formação jurídica ou estatística. Evitar linguagem promocional sobre precisão.

| Evitar na camada principal | Preferir |
| --- | --- |
| Prever sentenças | Estimar o tempo até a sentença |
| Snapshot | Dados atualizados em / data de referência dos dados |
| Censurados | Processos sem sentença observada até o fim do acompanhamento |
| Curva de sobrevivência | Processos ainda sem sentença ao longo do tempo |
| Input inválido | Informe um tempo de tramitação válido |
| Nenhum resultado | Não há estimativa disponível para esta combinação |

Termos técnicos podem aparecer na metodologia, acompanhados de explicação. Mensagens de erro devem dizer o que aconteceu e como continuar. Detalhes de infraestrutura, nomes de arquivos e stack traces ficam fora da mensagem principal.

## 7. Direção visual

Personalidade: ferramenta pública de consulta, sóbria e acolhedora. Priorizar leitura e gráficos; evitar imagens de tribunais decorativas, martelos, grandes banners e animações que disputem atenção com a tarefa.

Preservar a identidade magenta existente como ponto de partida. Usar fundo claro neutro, superfícies de resultado bem separadas e texto escuro. O modo escuro deve receber verificação própria; inverter cores não basta.

### Tokens

Manter `web/src/tokens.css` como fonte dos valores compartilhados. Os nomes abaixo são uma proposta de consolidação; mapear os tokens existentes antes de renomear.

| Família | Tokens semânticos sugeridos | Uso |
| --- | --- | --- |
| Superfícies | `--color-bg`, `--color-surface`, `--color-surface-muted` | Página, resultado e áreas secundárias |
| Texto | `--color-text`, `--color-text-secondary` | Texto principal e apoio legível |
| Ação | `--color-action`, `--color-on-action`, `--color-focus` | Botão principal e foco |
| Estados | `--color-error`, `--color-warning`, `--color-info` | Estados acompanhados de texto |
| Gráficos | `--color-series-a`, `--color-series-b`, `--color-grid` | Séries e grade, independentes dos estados |
| Linhas | `--color-border`, `--color-border-strong` | Divisórias decorativas e bordas de controle (≥ 3:1) |
| Faixas e inversão | `--color-band-a`, `--color-band-b`, `--color-inverse`, `--color-on-inverse` | Banda de confiança de cada série; faixa de dado sintético |

Não usar verde/vermelho para classificar duração como boa/ruim. Séries devem diferir também por traço ou identificação textual. A banda de confiança precisa continuar distinguível nos dois temas.

### Tipografia, medidas e espaçamento

- Hanken Grotesk como fonte inicial de interface, controles, títulos e resultados.
- Newsreader opcional em explicações longas; evitar alternância de fonte a cada pequeno elemento.
- Números tabulares em comparações e tabelas. IBM Plex Mono apenas quando melhorar alinhamento ou identificação de dados.
- Corpo de texto: 16 px como ponto inicial; auxiliares: 14 px. Não reduzir o texto essencial para caber no layout.
- Títulos de seção: 24–28 px; probabilidades principais: 32–40 px. Ajustar à largura real e ao conteúdo.
- Entrelinhas de corpo: aproximadamente 1,5; limitar parágrafos longos a cerca de 65 caracteres por linha.
- Escala de espaço: 4, 8, 12, 16, 24, 32, 40 e 64 px. Usar 8 px entre rótulo e controle, 16–24 px entre campos e 32–40 px entre seções como ponto inicial.
- Cantos discretos, até 4 px em campos e botões; painéis podem manter cantos retos. Sombras apenas quando necessárias para comunicar sobreposição.

Esses valores são decisões iniciais de design, não resultados de testes. Não introduzir novos valores arbitrários em cada tela.

## 8. Componentes mínimos

| Componente | Contrato de comportamento |
| --- | --- |
| Campo | Rótulo permanente, ajuda vinculada, valor, erro textual e estado desabilitado |
| Botão principal | Verbo claro; uma ação principal por etapa; foco visível |
| Abas | Seleção perceptível, teclado funcional e painel associado |
| Resumo de estimativa | Horizonte, probabilidade, intervalo disponível e contexto |
| Aviso | Motivo, impacto e próximo passo; significado não depende só da cor |
| Gráfico | Título, unidades, legenda, resumo textual, acesso por teclado e tabela equivalente |
| Tabela | Cabeçalhos claros, unidades, alinhamento numérico e rolagem localizada quando necessária |
| Detalhes expansíveis | Resumo compreensível; informação técnica secundária; operação por teclado |

Preferir controles HTML nativos. Criar seleção pesquisável apenas quando o volume de opções justificar, preservando acessibilidade. Reutilizar comportamento além de aparência.

## 9. Estados obrigatórios

| Estado | Resposta da interface |
| --- | --- |
| Inicial | Explicação curta e formulário; sem resultado personalizado fictício |
| Carregando | Mensagem de status e estrutura estável |
| Entrada inválida | Erro junto do campo e orientação de correção; validar no envio ou momento apropriado |
| Combinação indisponível | Explicar ausência e oferecer revisão dos filtros; não substituir recorte automaticamente |
| Horizonte excedido | Informar limite dos dados; não extrapolar silenciosamente |
| Estimativa instável | Aviso próximo ao resultado, baseado nas informações realmente disponíveis |
| Quantil não estimável | Informar que o prazo não foi estimado no período observado |
| Falha de carregamento | Mensagem compreensível e ação para tentar novamente |
| Dados sintéticos | Faixa persistente e identificação inequívoca nos resultados |

Não atribuir toda ausência de curva a amostra pequena se o contrato não informar a causa específica.

## 10. Responsividade e acessibilidade

- No celular: formulário antes do resultado, uma coluna e sem controles presos à tela que ocultem conteúdo.
- Em telas largas: controles à esquerda e resultado à direita, desde que a leitura mantenha ordem lógica.
- Verificar larguras de 320, 375, 768 e 1280 px, zoom de 200%, textos longos e nomes extensos de varas.
- Nenhuma informação essencial depende de hover. Gráficos devem aceitar toque, teclado e consulta por tabela.
- Meta de contraste: ao menos 4,5:1 para texto comum e 3:1 para texto grande e elementos gráficos essenciais; verificar combinações concretas.
- Preferir alvos interativos de pelo menos 44 × 44 px.
- Foco sempre visível; ordem de tabulação previsível; não mover foco a cada atualização de resultado.
- Usar anúncios sucintos para alterações de resultado. Não anunciar toda a tela repetidamente.
- Manter link de pular para conteúdo, rótulos associados e respeito a movimento reduzido.
- Não esconder problemas de largura com corte global de overflow. Resolver o elemento que excede a tela.

## 11. Implementação incremental

1. Revisar fluxo e textos de `web/src/main.ts` e `web/src/meu-processo.ts`.
2. Implementar a jornada Estimar tempo com estados completos, usando o módulo matemático existente.
3. Consolidar tokens e componentes compartilhados em `tokens.css`, `base.css`, `estilo.css` e `ui.ts` conforme suas responsabilidades.
4. Aplicar os padrões aprovados em `explorar.ts` e `grafico.ts`.
5. Criar uma página interna de componentes com estados normal, foco, erro, indisponível e carregamento.
6. Atualizar este documento quando decisões intencionais mudarem.

Manter `sobrevivencia.ts` e o contrato de dados separados da apresentação. Executar os testes existentes e o build após alterações; mudanças no significado estatístico exigem revisão específica.

Uma ferramenta como Impeccable deve ler este documento e o código atual, propor mudanças delimitadas e verificar o resultado no navegador. Não deve inventar dados, remover incerteza para simplificar layout nem migrar a stack sem justificativa de produto.

## 12. Critérios de aceitação

- [ ] A pessoa identifica que o produto estima tempo até sentença, não chance de vitória.
- [ ] O resultado corresponde a filtros explicitamente escolhidos.
- [ ] Tempo decorrido e tempo adicional estão distintos.
- [ ] Probabilidades, intervalos disponíveis e limitações essenciais aparecem próximos.
- [ ] Ausência de estimativa não é apresentada como zero.
- [ ] Atualização e cobertura dos dados são visíveis.
- [ ] A tarefa principal pode ser concluída no celular e por teclado.
- [ ] Gráfico e tabela expressam os mesmos dados e unidades.
- [ ] Estados de erro e dados insuficientes oferecem um próximo passo.
- [ ] Testes existentes e build passam; contraste e layout foram verificados nos dois temas.

Fazer uma rodada inicial com 3–5 pessoas dos públicos-alvo. Pedir que estimem um cenário, expliquem um percentual, identifiquem o tempo de referência e descrevam o que a ferramenta não prevê. Registrar dificuldades, revisar e repetir. Essa rodada encontra problemas; não comprova usabilidade universal.

## 13. Referências e base de elaboração

- Repositório analisado: https://github.com/PedroCamargoLINCE/ampulheta — leitura da versão `main` nesta conversa, incluindo README, tokens, base CSS, interface, telas e gráfico.
- GOV.UK Design System: https://design-system.service.gov.uk/ — referência para clareza de tarefas e formulários.
- Carbon Design System: https://carbondesignsystem.com/ — referência complementar para interfaces analíticas.
- Impeccable: https://impeccable.style/designing/ — apoio ao processo de design e implementação.

As referências orientam o trabalho. A identidade e os componentes finais pertencem ao Ampulheta; não sugerir vínculo institucional com os sistemas usados como referência.
