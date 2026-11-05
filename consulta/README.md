# Consulta por número

Função mínima e sem estado entre o site e a API Pública do DataJud, que não aceita CORS
(ADR-016). Roda no plano gratuito do Cloudflare Workers.

- `GET /?numero=<CNJ>`: aceita só número CNJ válido do TJSP (dígitos verificadores conferidos)
  e devolve classe, órgão julgador, data de ajuizamento e movimentos (código e data) de cada
  registro do processo. Nenhum outro tipo de consulta é aceito.
- Nada é gravado. A chave da API fica como segredo do Worker, nunca em arquivo versionado.
- CORS liberado só para `ORIGENS_PERMITIDAS` (`wrangler.toml`): o site publicado e o `npm run dev`.
- Respostas parciais da API (shard recusado ou `timed_out`) viram "tente de novo", não
  "número inexistente" — o mesmo critério do coletor do pipeline.
- A API leva de 30 s a 1 min; a função espera até 90 s. No Workers, esperar a rede não conta
  no limite de CPU do plano gratuito. Quando a API está cheia, quem tenta de novo é o navegador
  (até 5 minutos, com a página aberta): a função continua sem estado.

O site lê o endereço da função de `VITE_CONSULTA_URL` no build. Sem ele, a busca por número
não aparece e o resto funciona como antes.

## Pôr no ar (uma vez)

São três segredos e uma variável, todos guardados nas configurações do repositório no GitHub,
nunca em arquivo. Faça os passos 1 e 2 **antes** de mergear o PR que cria `consulta/`: o merge
dispara o workflow, que já publica a função.

**1. Token do Cloudflare** (conta gratuita; não precisa de domínio nem de cartão)

1. Abra https://dash.cloudflare.com/profile/api-tokens. É a página **API Tokens** do seu perfil,
   pelo ícone de pessoa no canto superior direito → **Profile**. Não fica em *Workers & Pages*.
2. Clique em **Create Token** e, na linha **Edit Cloudflare Workers**, em **Use template**.
3. Em **Account Resources**, deixe *Include* e escolha a sua conta. Se aparecer **Zone Resources**,
   escolha *Include → All zones*.
4. **Continue to summary** → **Create Token**. Copie o token na hora: ele só aparece uma vez.
5. Anote também o **Account ID**: em *Workers & Pages*, no quadro *Account details* à direita.

**2. Segredos no GitHub**

Em https://github.com/PedroCamargoLINCE/ampulheta/settings/secrets/actions, clique em
**New repository secret** três vezes:

| Name | Secret |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | o token do passo 1 |
| `CLOUDFLARE_ACCOUNT_ID` | o Account ID |
| `DATAJUD_API_KEY` | a chave pública em datajud-wiki.cnj.jus.br/api-publica/acesso: o texto longo depois de `APIKey `, sem essa palavra |

**3. Publicar a função.** Mergeie o PR. O workflow **consulta** (aba *Actions*) testa e publica.
A função fica em `https://ampulheta-consulta.<seu-subdominio>.workers.dev`; o subdomínio aparece
em *Workers & Pages → Account details → Subdomain*. Para conferir, abra esse endereço com
`?numero=123`: deve responder `{"erro":"Informe os 20 dígitos do número do processo."}`.

**4. Ligar a busca no site.** Em
https://github.com/PedroCamargoLINCE/ampulheta/settings/variables/actions, clique em
**New repository variable**, com Name `CONSULTA_URL` e Value o endereço do passo 3. Depois, em
*Actions → site → Run workflow*, gere o site de novo.

Depois disso, todo push em `consulta/` no `main` testa e publica a função sozinho. Quando o CNJ
trocar a chave pública, basta atualizar o segredo `DATAJUD_API_KEY` e rodar o workflow
**consulta** de novo (*Actions → consulta → Run workflow*).

## Desenvolver

```bash
cd consulta && npm test
```

Os testes usam uma API falsa e não chamam o CNJ. Para testar o site com a função de verdade,
rode-a com `npx wrangler dev` (com `DATAJUD_API_KEY` em `consulta/.dev.vars`, que o git ignora)
e o site com `VITE_CONSULTA_URL=http://localhost:8787/ npm run dev` em `web/`.
