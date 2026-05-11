# 🎫 Sistema de Tickets Premium

<p align="center">
  <img src="https://cdn.discordapp.com/emojis/1502789959378145300.png" width="100" height="100" alt="Ticket Logo">
</p>

<p align="center">
  <b>Um sistema de atendimento avançado para Discord, focado em alta performance, design premium e gestão visual completa.</b><br>
  <i>Desenvolvido com as tecnologias mais modernas de Components V2, Dashboards Interativos e Transcripts Online.</i>
</p>

---

## 🚀 Funcionalidades Premium

### ⚙️ Dashboard Interativo de Configuração
*   **Gestão 100% Visual**: Configure canais de logs, cofre de mídia e cargo de equipe sem comandos de texto.
*   **Categorias Dinâmicas**: Crie e remova setores de atendimento (Suporte, VIP, Financeiro) diretamente pelo painel.
*   **Controle de Funcionamento**: Sistema de **"Abrir/Fechar Loja"** que bloqueia novas aberturas com um clique.
*   **Personalização de Canais**: Escolha emojis exclusivos para cada categoria ou um emoji global para os canais de ticket.

### 🛠️ Gestão Avançada de Tickets
*   **Sistema de Claim**: Botão de "Assumir Ticket" com feedback visual e logs de quem está atendendo.
*   **Gestão de Membros**: Adicione ou remova usuários do ticket apenas inserindo o ID no formulário.
*   **Logs de Abertura e Fechamento**: Registro completo do ciclo de vida do atendimento em canais de logs dedicados.
*   **Cargo Staff Customizável**: Permita que sua equipe gerencie os tickets sem precisar de permissão de Administrador.

### 📄 Transcript Web Integrado
*   **Logs em Nuvem**: Histórico de mensagens salvo no MongoDB e visualizado em um domínio customizado (ex: `https://seu-site.vercel.app`).
*   **Backup Permanente**: Sistema de **Cofre (Vault)** que salva imagens e anexos permanentemente para evitar links expirados.
*   **Design Premium**: Transcripts com visual limpo, cronologia detalhada e motivo da abertura em destaque.

---

## 🎨 Identidade Visual & UX

*   **Components V2 & Modais V2**: Utiliza o que há de mais moderno na API do Discord para uma experiência fluida.
*   **Ícones Customizados**: Mais de 50 emojis de alta qualidade integrados nativamente em todas as interfaces.
*   **Guia de Configuração**: Manual interativo embutido no Dashboard para facilitar o setup inicial.

---

## 🛠️ Tecnologias Utilizadas

### Bot do Discord
*   **Framework**: [Constatic](https://constatic-docs.vercel.app) + @magicyan/discord
*   **Linguagem**: TypeScript
*   **Banco de Dados**: MongoDB Atlas (Mongoose)

### Web & API
*   **Frontend**: Next.js 14+ (Tailwind CSS + Lucide Icons)
*   **Deploy**: Vercel (Otimizado com Sharp para pnpm)

---

## ⚙️ Instalação Rápida

1.  **Instalar Dependências**: `npm install` e dentro de `/web` use `pnpm install`.
2.  **Configurar `.env`**:
    ```env
    BOT_TOKEN=seu_token_aqui
    MONGO_URI=sua_uri_mongodb
    WEB_URL=https://seu-dominio.vercel.app
    ```
3.  **Iniciar**: `npm run dev`
4.  **Setup**: Use `/ticket configurar` no Discord e siga o **Guia Visual**.

---

<p align="center">
  Criado com ❤️ por <b>Mts</b><br>
</p>
