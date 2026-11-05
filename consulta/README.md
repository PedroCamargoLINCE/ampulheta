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
  no limite de CPU do plano gratuito.

O site lê o endereço da função de `VITE_CONSULTA_URL` no build. Sem ele, a busca por número
não aparece e o resto funciona como antes.

## Pôr no ar (uma vez)

1. Crie uma conta gratuita no Cloudflare. Em **My Profile → API Tokens**, crie um token com o
   modelo **Edit Cloudflare Workers**. Anote também o **Account ID** (painel, coluna da direita).
2. No GitHub, em **Settings → Secrets and variables → Actions → Secrets**, crie:
   - `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`, do passo 1;
   - `DATAJUD_API_KEY`, com a chave pública vigente de
     datajud-wiki.cnj.jus.br/api-publica/acesso (só a chave, sem `APIKey`).
3. Em **Actions → consulta → Run workflow**, rode o workflow. O passo do Wrangler mostra o
   endereço publicado, no formato `https://ampulheta-consulta.<seu-subdominio>.workers.dev`.
4. Em **Settings → Secrets and variables → Actions → Variables**, crie `CONSULTA_URL` com esse
   endereço e rode **Actions → site → Run workflow** para gerar o site com a busca.

Depois disso, todo push em `consulta/` no `main` testa e publica a função sozinho. Quando o CNJ
trocar a chave pública, basta atualizar o segredo `DATAJUD_API_KEY` e rodar o workflow de novo.

## Desenvolver

```bash
cd consulta && npm test
```

Os testes usam uma API falsa e não chamam o CNJ. Para testar o site com a função de verdade,
rode-a com `npx wrangler dev` (com `DATAJUD_API_KEY` em `consulta/.dev.vars`, que o git ignora)
e o site com `VITE_CONSULTA_URL=http://localhost:8787/ npm run dev` em `web/`.
