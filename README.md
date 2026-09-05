# 🤖 Sistema Avançado de Tickets & Atendimento (Discord Bot)

Sistema completo e profissional de atendimento e vendas para Discord, desenvolvido em **TypeScript** com **Discord.js v14**, **Components V2**, **Mongoose (MongoDB Atlas)** e integração web para **transcripts online** e **entrega de mídias**.

---

## 🚀 Funcionalidades Principais

- 🎫 **Abertura Inteligente de Tickets:**
  - Interface moderna com **Components V2** e modais interativos.
  - Seleção de categorias dinâmicas com suporte a emojis customizados.
  - Verificação de status ("Loja Aberta / Fechada") e prevenção contra tickets duplicados.

- 🛠️ **Painel Administrativo do Atendimento:**
  - **Assumir / Largar (Claim):** Atribuição de atendente responsável com feedback visual.
  - **Status do Pedido:** Atualização de status com alteração dinâmica de emoji no canal e reposicionamento por prioridade.
  - **Gerador de PIX Dinâmico:** Geração automática de payload oficial PIX Copia e Cola com cálculo de checksum CRC16.
  - **Transferência:** Transferência dinâmica do ticket entre categorias.
  - **Notificações:** Envio de alertas automáticos via DM ao cliente.
  - **Gestão de Membros:** Adicionar e remover usuários com permissões específicas no canal.

- 🌐 **Transcripts Online & Hub de Mídias:**
  - Aplicação Web integrada desenvolvida em **Next.js 16** (`ticket-mts.vercel.app`).
  - Histórico completo de conversas, anexos, avatares e timeline do atendimento.
  - Sistema de upload de mídias finalizadas pela Staff (`/upload/:token`) com compactação automática em ZIP e envio por fila de DM segura.
  - Consulta pública de arquivos entregues através do ID do ticket (`/entregas/:id`).

- ⚡ **Otimização Extrema de Memória RAM & Cache:**
  - **Auto-limpeza Periódica:** Rotina executada a cada 15 minutos limpando mensagens, usuários e membros inativos da memória.
  - **V8 Garbage Collection:** Integração com `--expose-gc` para liberação imediata de memória RAM na hospedagem.
  - **Sweepers Ativos:** Varreduras contínuas no Discord.js descartando mensagens antigas a cada 5 minutos.
  - **Limites Rígidos de Cache:** Otimizado especialmente para operar com alta estabilidade em containers de 512MB (Discloud).
  - **Comando Manual:** Subcomando `/ticket limpar-cache` para visualização de métricas e liberação sob demanda.

---

## 📋 Comandos da Staff

| Comando | Descrição |
| :--- | :--- |
| `/ticket painel [canal]` | Envia o painel interativo de abertura de tickets no canal selecionado. |
| `/ticket configurar` | Abre o dashboard visual de configurações (canais de logs, vault, chave PIX, cargo staff, status da loja e categorias). |
| `/ticket stats` | Exibe as estatísticas de atendimentos (hoje, semana, mês, total e por categoria). |
| `/ticket limpar-cache` | Executa a limpeza da memória RAM e cache temporário, exibindo relatório de MBs liberados. |
| `/ajuda` | Exibe a central de ajuda e informações gerais do bot. |

---

## 🛠️ Stack Tecnológica

- **Linguagem:** TypeScript
- **Runtime:** Node.js (v20+)
- **Framework Discord:** [Discord.js v14](https://discord.js.org/) + [@constatic/base](https://constatic-docs.vercel.app) + `@magicyan/discord`
- **Banco de Dados:** MongoDB Atlas com Mongoose
- **Interface Web:** Next.js 16 (App Router), React 19, Tailwind CSS v4 e Lucide Icons
- **Deploy:** Discloud (Bot) & Vercel (Web App)

---

## 🔧 Instalação e Configuração

### 1. Clonar o repositório
```bash
git clone https://github.com/mtziiinn/ticket.git
cd ticket
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto com base no modelo abaixo:

```env
BOT_TOKEN=SEU_TOKEN_DO_DISCORD
NODE_OPTIONS="--no-warnings --no-deprecation"
MONGO_URI=mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/database?retryWrites=true&w=majority&appName=Cluster0&authSource=admin
DATABASE_NAME=database
WEB_URL=https://ticket-mts.vercel.app
```

> **Atenção:** No MongoDB Atlas, certifique-se de liberar o IP em **Network Access** (`0.0.0.0/0`) para permitir conexões da sua máquina e da hospedagem.

### 4. Compilar e Executar

**Modo Desenvolvimento:**
```bash
npm run dev
```

**Verificação de Tipos TypeScript:**
```bash
npm run check
```

**Build de Produção:**
```bash
npm run build
```

**Iniciar em Produção:**
```bash
npm run start
```

---

## ☁️ Hospedagem na Discloud

O projeto já inclui o arquivo `discloud.config` devidamente configurado com otimizações de memória:

```ini
NAME=ticket
TYPE=bot
MAIN=build/index.js
RAM=512
VERSION=latest
AUTORESTART=true
START=node --expose-gc --max-old-space-size=460 --env-file=.env build/index.js
AVATAR=https://i.imgur.com/F4QzKsc.png
```

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
