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

A busca por número só aparece quando `VITE_CONSULTA_URL` aponta para a função de
`../consulta/` (no CI, a variável `CONSULTA_URL` do repositório; ver `../consulta/README.md`):

```sh
VITE_CONSULTA_URL=http://localhost:8787/ npm run dev
```

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

Sem dependência em produção e sem telemetria. Recursos externos: a fonte (Hanken Grotesk, do
Google Fonts) e, quando configurada, a função da consulta por número, chamada só quando a
pessoa pede uma busca.

## Organização

| Arquivo | Papel |
| --- | --- |
| `src/sobrevivencia.ts` | interpolação de S(t), P(sentença em h meses \| t) e seu IC 95%, quantis; puro e testado |
| `src/dados.ts` | tipos do contrato, carga do JSON, busca de curva por transição |
| `src/base.ts` | até onde cada curva tem base (`em_risco`) |
| `src/consulta.ts` | consulta por número: validação do CNJ e leitura da resposta em vara, classe, fase e tempo |
| `src/grafico.ts` | gráfico SVG acessível |
| `src/ui.ts` | componentes compartilhados (campo, escolha, aviso, cartão, link) |
| `src/estimar.ts` | tela Estimar tempo: busca por número, fase, probabilidades em 3, 6 e 12 meses e curva condicional |
| `src/explorar.ts` | tela Explorar dados: curvas com IC por transição, prazos e comparação de dois recortes |
| `src/main.ts` | abas, faixa de dado sintético, rodapé com a fonte e a data dos dados |

## Regras que o site segue

- Rodapé em toda tela com `fonte.citacao`, link da fonte e data do snapshot (Portaria CNJ).
- P(sentença nos próximos *h* meses | tramita há *t*) = `1 − S(t+h)/S(t)`, com interpolação
  linear na grade (ADR-007). Se `S(t) = 0` ou `t + h` passa do horizonte, a tela diz isso
  em vez de mostrar número.
- O IC 95% dessa probabilidade usa `greenwood_acumulado` (contrato 1.1.0):
  Var(log S(t+h)/S(t)) = σ²(t+h) − σ²(t), na escala log(−log) dos `ic_*`. Sem o campo,
  a tela diz que não há IC; com S(t+h)/S(t) igual a 0 ou 1, diz que o IC não se define.
- Nenhum número sozinho: a curva aparece junto, com IC na tela Explorar, e n, eventos e
  censurados acompanham cada estimativa.
