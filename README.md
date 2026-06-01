# 🎫 Sistema de Tickets Premium

<p align="center">
  <img src="https://cdn.discordapp.com/emojis/1502789959378145300.png" width="100" height="100" alt="Ticket Logo">
</p>

<p align="center">
  <b>Um sistema de atendimento avançado para Discord, focado em alta performance, design premium e gestão visual completa.</b><br>
  <i>Desenvolvido com as tecnologias mais modernas de Components V2, Dashboards Interativos e Transcripts Online.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24.15-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js-16.2-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/discord.js-14.26-5865F2?logo=discord&logoColor=white" alt="discord.js">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## 🚀 Funcionalidades Premium

### ⚙️ Dashboard Interativo de Configuração
*   **Gestão 100% Visual**: Configure canais de logs, cofre de mídia e cargo de equipe sem comandos de texto.
*   **Categorias Dinâmicas**: Crie e remova setores de atendimento (Suporte, VIP, Financeiro) diretamente pelo painel.
*   **Chave PIX Centralizada**: Configure sua chave de pagamento uma única vez para uso em todos os atendimentos.
*   **Controle de Funcionamento**: Sistema de **"Abrir/Fechar Loja"** que bloqueia novas aberturas com um clique.
*   **Personalização de Canais**: Emojis dinâmicos que mudam automaticamente de acordo com o status do pedido.

### 💰 Sistema de Pagamentos Integrado
*   **Faturamento Instantâneo**: Botão de "Enviar PIX" no Painel Admin que gera cobranças na hora.
*   **QR Code Dinâmico**: O bot gera automaticamente uma imagem de QR Code para facilitar o pagamento do cliente.
*   **Copia e Cola**: Chave PIX enviada em bloco de código formatado para cópia rápida no celular.
*   **Status de Encomenda**: Acompanhe o progresso com status visuais (🔴 Alinhando, 🟡 Pagamento, 🟠 Produção, 🟢 Concluída).

### 📤 Entrega de Mídia via Upload Direto
*   **Upload pelo Site**: Staff gera um link único e faz upload do arquivo final diretamente pelo navegador, sem perda de qualidade.
*   **Suporte a Múltiplos Arquivos**: Selecione vários arquivos de uma vez — o sistema compacta tudo em um único arquivo ZIP automaticamente.
*   **Finalização Automática**: Ao concluir o upload, a entrega é finalizada automaticamente — o bot envia a confirmação no canal e enfileira uma DM para o cliente com container personalizado.
*   **Armazenamento no MongoDB**: Arquivos salvos diretamente no banco (collection `delivery_files`), gerenciado pela web API.
*   **Página de Recuperação**: Cliente acessa `https://seu-site.vercel.app/entregas/[ID]` para baixar os arquivos entregues.
*   **Expiração**: Links de download expiram em **7 dias**; arquivos são automaticamente deletados do banco via TTL index após **30 dias**.

### 🛠️ Gestão Avançada de Tickets
*   **Sistema de Claim**: Botão de "Assumir Ticket" com feedback visual e logs de quem está atendendo.
*   **Gestão de Membros**: Adicione ou remova usuários do ticket apenas inserindo o ID no formulário.
*   **Status com Prioridade**: Ao mudar o status do pedido, o canal é automaticamente reposicionado na categoria por ordem de prioridade.
*   **Logs Completos**: Ciclo de vida registrado desde a abertura até o fechamento com considerações finais.
*   **Cargo Staff Customizável**: Permita que sua equipe gerencie os tickets sem precisar de permissão de Administrador.

### 📄 Transcript Web Integrado
*   **Logs em Nuvem**: Histórico de mensagens salvo no MongoDB e visualizado em URL customizada.
*   **Busca de Transcrições**: Página inicial com campo de busca por ID do ticket.
*   **Backup Permanente**: Sistema de **Cofre (Vault)** que salva imagens e anexos permanentemente para evitar links expirados.

### 🤖 Eventos do Bot
*   **ready**: Define status "Não Perturbe" com cycling automático entre mensagens personalizadas.
*   **guildCreate**: Cria configuração padrão automaticamente ao entrar em um servidor.
*   **guildDelete**: Remove todos os dados (config, tickets, transcripts, members) ao sair.

---

## 🎨 Identidade Visual & UX

*   **Components V2 & Modais V2**: Utiliza o que há de mais moderno na API do Discord para uma experiência fluida.
*   **Ícones Customizados**: Emojis de alta qualidade integrados nativamente em todas as interfaces.
*   **Guia de Configuração**: Manual interativo embutido no Dashboard para facilitar o setup inicial.

---

## 🛠️ Tecnologias Utilizadas

### Bot do Discord
*   **Framework**: [Constatic](https://constatic-docs.vercel.app) + @magicyan/discord
*   **Linguagem**: TypeScript
*   **Runtime**: Node.js 24+
*   **Banco de Dados**: MongoDB Atlas (Mongoose + MongoDB Driver)

### Web & API
*   **Frontend**: Next.js 16+ (Tailwind CSS v4 + Lucide Icons + shadcn/ui)
*   **Deploy**: Vercel (Otimizado com Sharp para pnpm/npm)

---

## 📁 Estrutura do Projeto

```
/
├── src/                      # Código fonte do bot Discord
│   ├── database/             # Models e conexão MongoDB
│   │   ├── index.ts          # Conexão + modelos (guilds, tickets, transcripts, members, pending_deliveries, dm_queue)
│   │   ├── utils.ts          # Schema helpers
│   │   └── schemas/          # Schemas individuais
│   │       ├── guild.ts
│   │       ├── member.ts
│   │       ├── ticket.ts
│   │       ├── transcript.ts
│   │       └── pendingDelivery.ts
│   ├── discord/              # Comandos, eventos e responders
│   │   ├── index.ts          # Setup dos creators (createCommand, createEvent, createResponder)
│   │   ├── commands/
│   │   │   ├── staff/ticket.ts    # /ticket painel, configurar, stats
│   │   │   └── public/help.ts     # /help
│   │   ├── events/
│   │   │   ├── ready.ts           # Status dnd + cycling
│   │   │   ├── guildCreate.ts     # Auto-config ao entrar
│   │   │   └── guildDelete.ts     # Cleanup ao sair
│   │   └── responders/
│   │       └── ticket/
│   │           ├── submit.ts      # Abertura de ticket (form, seleção, submissão)
│   │           ├── manage.ts      # Ações do painel de gestão
│   │           ├── admin.ts       # Renomear, entregar mídia, fechar
│   │           ├── config.ts      # Painel de configuração interativo
│   │           ├── members.ts     # Gerenciar membros do ticket
│   │           └── logger.ts      # Envio de logs de ações
│   ├── functions/index.ts    # Utilitários (PIX, formatEmoji)
│   ├── index.ts              # Entry point do bot (cleanups, DM queue)
│   ├── constants.ts          # Import de constants.json + emojis.json
│   ├── clear-db.ts           # Script para limpar tickets/transcripts do banco
│   └── env.ts                # Leitura das env vars
├── web/                      # Dashboard Next.js
│   ├── app/
│   │   ├── page.tsx                  # Home com busca de tickets/entregas
│   │   ├── layout.tsx                # Layout raiz
│   │   ├── api/
│   │   │   ├── upload/[token]/route.ts   # Upload de mídia (arquivos → MongoDB)
│   │   │   ├── file/[token]/route.ts     # Download de arquivo com expiração
│   │   │   └── transcripts/route.ts      # CRUD de transcrições
│   │   ├── upload/[token]/page.tsx       # Página de upload de mídia
│   │   ├── entregas/[id]/page.tsx        # Recuperação de entregas
│   │   └── transcripts/[id]/page.tsx     # Visualização de transcrições
│   ├── components/
│   │   ├── transcript/                  # Componentes do visualizador de transcript
│   │   └── ui/                          # shadcn/ui components (~50 componentes)
│   ├── hooks/                           # Custom hooks
│   ├── lib/                             # Utilitários (mongodb, types, utils)
│   └── public/                          # Assets estáticos
├── build/                   # Compilação TypeScript (gerado)
├── constants.json           # Cores e constantes
├── emojis.json              # IDs de emojis customizados
├── discloud.config          # Configuração de deploy DisCloud
├── .env.example             # Template de variáveis de ambiente
├── LICENSE                  # MIT License
└── package.json             # Dependências e scripts
```

---

## ⚙️ Instalação

### Pré-requisitos
- **Node.js** 24+
- **npm** ou **pnpm**
- **MongoDB Atlas** (ou instância local)
- **Conta na Vercel** (para o dashboard)

### Passo a Passo

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/ticket.git
   cd ticket
   ```

2. **Instale as dependências**
   ```bash
   npm install
   cd web && npm install && cd ..
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env
   ```
   ```env
   BOT_TOKEN=seu_token_aqui
   NODE_OPTIONS=--experimental-strip-types
   MONGO_URI=sua_uri_mongodb
   DATABASE_NAME=nome_do_banco
   WEB_URL=https://seu-dominio.vercel.app
   API_KEY=chave_secreta_para_api
   ```

4. **Inicie o bot em desenvolvimento**
   ```bash
   npm run dev
   ```

5. **Inicie o dashboard**
   ```bash
   cd web
   npm run dev
   ```

6. **Configure no Discord**
   Use `/ticket configurar` e siga o **Guia Visual**.

7. **Veja as estatísticas**
   Use `/ticket stats` para conferir tickets abertos por período e categoria.

---

## 📜 Scripts Disponíveis

### Raiz (`/`)
| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o bot com hot-reload (usando `--env-file=.env`) |
| `npm run build` | Compila TypeScript para JS |
| `npm run start` | Inicia o bot compilado |
| `npm run check` | Verifica tipos sem compilar |
| `npm run watch` | Inicia com watch mode |
| `npm run dev:dev` | Inicia com `.env.dev` |
| `npm run watch:dev` | Inicia watch mode com `.env.dev` |
| `npm run start:dev` | Inicia compilado com `.env.dev` |

### Web (`/web`)
| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Next.js (dev) |
| `npm run build` | Compila o dashboard para produção |
| `npm run start` | Inicia o servidor Next.js (produção) |
| `npm run lint` | Verifica código com ESLint |

### Comandos do Bot Discord
| Comando | Descrição |
|---|---|
| `/ticket painel <canal>` | Envia o painel de abertura de tickets em um canal |
| `/ticket configurar` | Abre o painel interativo de configuração |
| `/ticket stats` | Exibe estatísticas de tickets por período e categoria |
| `/help` | Lista todos os comandos públicos disponíveis |

---

## 🚢 Deploy

### Bot (Discloud ou VPS)
```bash
npm run build
npm run start
```

### Dashboard (Vercel)
Conecte o repositório na Vercel e configure as variáveis de ambiente:
- `MONGO_URI` — string de conexão MongoDB
- `DATABASE_NAME` — nome do banco (default: `database`)
- `BOT_TOKEN` — token do bot Discord (para notificações via REST API)
- `WEB_URL` — URL base do site (ex: `https://ticket-mts.vercel.app`)
- `API_KEY` — chave secreta para autenticação da API de transcripts

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

<p align="center">
  Criado com ❤️ por <b>Mts</b><br>
</p>
