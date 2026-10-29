# Site do Ampulheta

Site estático (ADR-005), hospedável no GitHub Pages. Lê um único arquivo,
`curvas.json`, no formato de `../contracts/`. Toda a conta roda no navegador.

## Rodar

```sh
npm install
npm run dev        # servidor local com recarga
npm test           # testes do módulo de matemática
npm run build      # gera dist/, pronto para publicar
npm run preview    # serve dist/ localmente
```

`dev` e `build` rodam antes `scripts/preparar-dados.mjs`, que escolhe
`../data/publicado/curvas.json` se existir ou a fixture sintética de
`../contracts/fixtures/` se não, passa o arquivo por `python3 ../contracts/validar.py`
e só então copia para `public/curvas.json`. Arquivo reprovado no validador derruba o build.
Com a fixture, o site mostra uma faixa de "dado sintético" no topo.

## Stack e por quê

- **TypeScript sem framework.** São duas telas com meia dúzia de controles; um
  framework traria mais código de infraestrutura do que de produto. O tipo estrito
  protege o que importa: o formato do contrato e a matemática.
- **Vite 5.** Servidor de desenvolvimento e build estático em um só pacote,
  compatível com o Node 18 desta máquina (Vite 6+ exige Node mais novo). `base: './'`
  faz o mesmo `dist/` funcionar em qualquer subcaminho do GitHub Pages.
- **Vitest 2.** Mesma configuração do Vite, roda os testes em TypeScript sem passo extra.
- **Gráfico em SVG à mão.** A curva é uma linha, uma faixa e um cursor; uma
  biblioteca de gráfico pesaria mais que o site inteiro. Fazer à mão também deixa
  controlar a acessibilidade: o SVG tem texto alternativo, aceita teclado (setas,
  PageUp/PageDown, Home/End), anuncia os valores em região `aria-live` e traz os
  mesmos números numa tabela.

Sem dependência em produção, sem serviço externo, sem telemetria.

## Organização

| Arquivo | Papel |
| --- | --- |
| `src/sobrevivencia.ts` | interpolação de S(t), P(sentença em h meses \| t), quantis; puro e testado |
| `src/dados.ts` | tipos do contrato, carga do JSON, busca de curva |
| `src/grafico.ts` | gráfico SVG acessível |
| `src/explorar.ts` | tela Explorar: curva com IC, quantis, amostra, comparação de duas curvas |
| `src/meu-processo.ts` | tela Meu processo: probabilidades em 3, 6 e 12 meses e curva condicional |
| `src/main.ts` | abas, faixa de dado sintético, rodapé com a fonte e o snapshot |

## Regras que o site segue

- Rodapé em toda tela com `fonte.citacao`, link da fonte e data do snapshot (Portaria CNJ).
- P(sentença nos próximos *h* meses | tramita há *t*) = `1 − S(t+h)/S(t)`, com interpolação
  linear na grade (ADR-007). Se `S(t) = 0` ou `t + h` passa do horizonte, a tela diz isso
  em vez de mostrar número.
- Nenhum número sozinho: a curva aparece junto, com IC na tela Explorar, e n, eventos e
  censurados acompanham cada estimativa.
