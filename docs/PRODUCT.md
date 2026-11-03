# Product

<!-- impeccable:product-schema 1 -->

Registro durável do produto Ampulheta: quem usa, para quê e o que não pode mudar.
Decisões visuais e de interface ficam em [`DESIGN.md`](DESIGN.md); método e arquitetura,
em [`PLANO.md`](PLANO.md) e [`DECISOES.md`](DECISOES.md).

## Platform

web

## Users

Dois públicos com o mesmo peso. Quando um precisar ceder ao outro, a camada principal
deve continuar compreensível para quem não tem formação jurídica nem estatística, e o
aprofundamento técnico fica a um passo, na metodologia e em Explorar dados.

- **Cidadão** com um processo em andamento no 1º grau, que quer entender quanto tempo
  ainda pode esperar até a sentença.
- **Advogado** que consulta e compara recortes históricos e usa o resultado para orientar
  um cliente.

Fora do escopo atual, embora citados no plano: escritórios usando as estimativas para
precificar honorários ou provisionar caixa, e pesquisadores comparando varas e tribunais.
Nada deve ser desenhado especificamente para eles por enquanto.

## Product Purpose

Estimar a distribuição do tempo até a sentença em 1º grau, com incerteza visível, a
partir de dados públicos. A pergunta principal: “dado que o processo já tramita há algum
tempo sem sentença, qual é a estimativa para os próximos meses?”.

Sucesso é a pessoa conseguir explicar o resultado com as próprias palavras: o que foi
estimado, para qual recorte, a partir de quando, e com qual incerteza.

O produto não prevê o conteúdo da decisão, a chance de ganhar, indenização, encerramento
definitivo do processo nem o tempo de recursos.

## Positioning

Análise de sobrevivência (Kaplan-Meier) sobre um snapshot público e versionado do
CNJ/DataJud, que usa também os processos ainda sem sentença em vez de descartá-los, e
por isso não tem o viés otimista de uma média simples sobre processos já julgados. Tudo
é reproduzível a partir do repositório, sem LLM e sem serviço pago.

## Operating Context

- O resultado sai da tela de três formas, e as três precisam funcionar:
  - **mostrado ao cliente**, na tela durante uma conversa ou como captura de tela enviada
    por mensagem, então o recorte, o tempo de referência e a data dos dados precisam
    estar visíveis junto dos números;
  - **compartilhado por link**, e quem abre deve ver o mesmo recorte;
  - **citado em documento, parecer ou relatório**, inclusive impresso.
- Hoje a URL guarda só a aba ativa (`#explorar`, `#meu-processo`). Filtros e tempo de
  tramitação não estão no link, e não há estilo de impressão. São lacunas conhecidas.

## Capabilities and Constraints

- Cobertura atual (ADR-003): TJSP, 1º grau, poucas varas (9 no snapshot de 2026-10-29) e
  3 classes, com agregações “Todas as varas” e “Todas as classes”. A ampliação para mais
  comarcas ou tribunais está prevista, mas ainda não decidida.
- Evento: primeiro movimento da família Julgamento (TPU 193 e filhos). Decisões de
  embargos de declaração não contam (ADR-010).
- Horizontes de 3, 6 e 12 meses, condicionados ao tempo já transcorrido. As curvas
  usam uma grade mensal fixa (ADR-007).
- Site estático em TypeScript, Vite e CSS, sem framework (ADR-005). Toda a conta roda no
  navegador a partir de um único `curvas.json`, validado pelo contrato em `contracts/`.
- O contrato de dados e `sobrevivencia.ts` ficam separados da apresentação. Mudanças no
  significado estatístico exigem revisão específica.
- Com a fixture sintética, o site precisa mostrar uma faixa persistente de dado sintético.

## Brand Commitments

- Nome: Ampulheta, porque mede o tempo que já passou e o que ainda falta.
- Identidade magenta existente como ponto de partida, conforme o DESIGN.md.
- Tom direto, respeitoso e tranquilo, em português brasileiro. Sem linguagem promocional
  sobre precisão.
- Não sugerir vínculo institucional com o CNJ, tribunais ou sistemas de design usados como
  referência.

## Evidence on Hand

- Snapshot real em `data/publicado/curvas.json` (contrato 1.2.0, snapshot 2026-10-29).
- Fixture sintética em `contracts/fixtures/`, que só pode aparecer identificada como tal.
- Não há depoimentos, clientes, métricas de uso nem testes com usuários. Não inventar
  nenhum deles. A rodada inicial com 3 a 5 pessoas (DESIGN.md, seção 12) ainda não
  aconteceu.

## Product Principles

1. **Interpretação correta antes de tudo.** Um número que pode ser lido errado é pior do
   que nenhum número.
2. **A incerteza faz parte do resultado.** Probabilidade, intervalo e limitações
   essenciais aparecem juntos.
3. **Nada de dado do usuário inventado.** O resultado corresponde só a filtros escolhidos
   explicitamente, e exemplos são identificados como exemplos.
4. **O resultado se explica sozinho fora do site.** Uma captura, um link ou uma citação
   precisa carregar o recorte, o tempo de referência e a data dos dados.
5. **O método vale mais do que a aparência.** Cálculos, horizontes e limiares não mudam
   para deixar a tela mais bonita.

## Accessibility & Inclusion

A tarefa principal deve funcionar no celular, só pelo teclado e com tecnologia assistiva.
As metas de contraste, alvos de toque e larguras verificadas estão na seção 10 do
DESIGN.md. São metas de projeto, não certificação.
