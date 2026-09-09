# Setup de um novo cliente

Cada cliente roda uma **cópia isolada** deste bot: token próprio, banco próprio,
app próprio na Discloud. Só o que muda de visual/identidade fica em
`brand.config.json`.

## 1. Copiar o projeto

Duplique a pasta (ou crie um repositório novo a partir dela). Não reaproveite a
pasta `.git`, o `.env` nem a pasta `build/` do cliente antigo.

## 2. Criar a aplicação/bot no Discord

1. https://discord.com/developers/applications → **New Application**.
2. Aba **Bot** → **Reset Token** → guarde o `BOT_TOKEN`.
3. Ative os **Privileged Gateway Intents**: Server Members e Message Content.
4. Aba **OAuth2 → URL Generator**: escopos `bot` + `applications.commands`,
   permissões de administrador (ou o conjunto que o cliente exigir), e use a URL
   para convidar o bot.

## 3. Emojis customizados

Os emojis (`emojis.json`) são de um **servidor** compartilhado, não da aplicação.
O bot novo **precisa estar nesse servidor**, senão as mensagens aparecem com
texto cru (ex.: `:prism:`). Convide o bot novo para esse servidor.

Se o cliente quiser emojis próprios: suba os mesmos nomes em um servidor dele,
gere um `emojis.json` novo com os IDs dele e substitua o arquivo.

## 4. Banco de dados

Use o **mesmo cluster Mongo** da Prism, mas com um `DATABASE_NAME` **diferente**
(ex.: `dusksociety`). Cada cópia do bot só enxerga o próprio banco — sorteios,
fila de DM, tickets, tudo isolado. Guarde o `MONGO_URI` (o mesmo da Prism).

## 5. Preencher o `.env`

Copie `.env.example` para `.env` e preencha:

| Variável | Observação |
|---|---|
| `BOT_TOKEN` | passo 2 — **é o único segredo que muda de verdade** |
| `MONGO_URI` | mesmo da Prism |
| `DATABASE_NAME` | **diferente** da Prism (ex.: `dusksociety`) |
| `WEB_URL` | domínio próprio deste cliente no painel (ver passo 11) |
| `NODE_OPTIONS` | `--experimental-strip-types` (igual ao exemplo) |
| `MP_ACCESS_TOKEN` | só se o cliente usar Mercado Pago (conta MP dele) |

## 6. Editar `brand.config.json`

| Campo | O que é |
|---|---|
| `brandName` | nome que aparece nos textos (`Central de Comandos • <brandName>`) |
| `appBio` | bio da aplicação, sincronizada no `ready` |
| `primaryColor` | cor primária; sobrescreve os azuis padrão de `constants.json` |
| `avatarUrl` | avatar usado no webhook de erros e no `discloud.config` |
| `headerEmojiId` | ID do emoji de cabeçalho padrão |
| `presence` | lista de status que o bot alterna a cada 1 min |
| `errorWebhook.url` | webhook do Discord para erros em tempo real; **vazio = desliga** |
| `errorWebhook.name` | nome exibido nesse webhook |

## 7. Gerar o `discloud.config`

```bash
node scripts/apply-brand.mjs
```

Isso reescreve `NAME=` e `AVATAR=`. Depois **abra `discloud.config` e apague o
valor de `ID=`** (deixe `ID=`) para a Discloud criar um app novo.

## 8. Build

```bash
npm install
npm run build
```

## 9. Publicar na Discloud

Primeira vez (cria o app e grava o `ID` no `discloud.config`):

```bash
discloud app upload
```

Publicações seguintes:

```bash
discloud app commit <ID>
```

> `commit` sobrescreve e adiciona arquivos, mas **não apaga** os que você removeu
> do projeto. Se remover um arquivo, apague-o também pelo terminal do app
> (`discloud app terminal <ID>`) ou pelo gerenciador de arquivos do painel.

## 10. Ajustes finos por servidor

No Discord, rode `/painel → Identidade Visual` para ajustar avatar, cor e
banner **por servidor** (isso fica no banco, não no `brand.config.json`).

## 11. Painel web (multi-tenant)

O `web/` é **um único deploy na Vercel** servindo todos os clientes. Ele
descobre qual cliente é pelo **domínio** da requisição.

1. Na Vercel, no projeto do `web/`, adicione um domínio novo para este cliente
   (ex.: `painel.dusk.com`).
2. Edite a env var **`TENANTS`** (JSON, uma linha) adicionando a entrada do
   cliente — domínio → `{ dbName, botToken, apiKey, mpAccessToken }`:

   ```json
   {
     "painel.prism.com": { "dbName": "database",    "botToken": "...", "apiKey": "...", "mpAccessToken": "..." },
     "painel.dusk.com":  { "dbName": "dusksociety", "botToken": "...", "apiKey": "...", "mpAccessToken": "..." }
   }
   ```

   - `apiKey` tem que ser **igual** ao `API_KEY` que você usa (o bot manda esse
     header ao criar transcript). Pode ser a mesma string para todos.
   - `botToken` é o token do bot **deste** cliente (o mesmo do `.env` dele).
3. Redeploy do `web/` (a Vercel pede após mudar env var).
4. No `.env` do bot, `WEB_URL` = `https://painel.dusk.com`.

Domínios fora do `TENANTS` continuam caindo no `BOT_TOKEN`/`DATABASE_NAME`/
`API_KEY` soltos do ambiente — então a Prism segue funcionando sem mexer em nada
até você migrar ela para dentro do `TENANTS` também.

## Checklist rápido

- [ ] Projeto copiado sem `.git` / `.env` / `build/` do cliente antigo
- [ ] Aplicação + bot criados, intents ligados, bot convidado
- [ ] Bot no servidor dos emojis
- [ ] `DATABASE_NAME` novo (mesmo cluster Mongo)
- [ ] `.env` preenchido
- [ ] `brand.config.json` editado
- [ ] `node scripts/apply-brand.mjs` rodado e `ID=` zerado
- [ ] `npm run build` sem erro
- [ ] `discloud app upload` feito
- [ ] Domínio do cliente adicionado na Vercel + entrada no `TENANTS` + redeploy do web
- [ ] `/painel → Identidade Visual` conferido
