# 🎫 Sistema de Tickets Premium

<p align="center">
  <img src="https://cdn.discordapp.com/emojis/1502789959378145300.png" width="100" height="100" alt="Ticket Logo">
</p>

<p align="center">
  <b>Um sistema de atendimento avançado para Discord, focado em alta performance, design premium e experiência do usuário.</b><br>
  <i>Desenvolvido com as tecnologias mais modernas de Components V2 e Transcripts Online.</i>
</p>

---

## 🚀 Funcionalidades Principais

### 🏢 Central de Atendimento
*   **Abertura Simplificada**: Interface moderna com diretrizes claras e botões interativos.
*   **Roteamento Inteligente**: Distribuição automática de tickets para categorias específicas (Suporte, Denúncia, Financeiro, Bugs).
*   **Modais V2**: Formulários de abertura limpos e intuitivos para coletar o motivo do contato.

### 🛠️ Painel Administrativo (Estilo Dashboard)
*   **Gestão de Membros**: Adicione ou remova usuários do ticket via menu interativo.
*   **Transferência Dinâmica**: Mova o ticket entre categorias sem perder o histórico.
*   **Sistema de Claim**: Sistema de "Assumir/Largar" com feedback visual em tempo real.
*   **Ferramentas Avançadas**: Renomear canais, notificar usuários via DM e gerenciar logs.

### 📄 Transcript Web Integrado
*   **Logs em Nuvem**: Histórico de mensagens salvo no MongoDB e visualizado em um site Next.js.
*   **Detalhes do Contato**: Exibição clara do motivo da abertura e cronologia do atendimento.
*   **Design Responsivo**: Transcripts otimizados para visualização em computadores e dispositivos móveis.

---

## 🎨 Design & Identidade Visual

O projeto utiliza uma identidade visual **Azul (#3b82f6)** com foco em organização e clareza:
*   **Separadores Visuais**: Todas as interfaces utilizam divisores de seção para facilitar a leitura.
*   **Ícones Customizados**: Mais de 50 emojis de alta qualidade integrados nativamente em todas as mensagens e botões.
*   **Layout Limpo**: Menus efêmeros que não poluem o canal, garantindo privacidade para a staff.

---

## 🛠️ Tecnologias Utilizadas

### Bot do Discord
*   **Framework**: [Constatic](https://constatic-docs.vercel.app) + @magicyan/discord
*   **Linguagem**: TypeScript
*   **Interface**: Components V2 & Modais V2

### Web & API
*   **Frontend**: Next.js 14+ (Tailwind CSS + Lucide Icons)
*   **API**: Next.js API Routes (Edge Runtime)
*   **Banco de Dados**: MongoDB Atlas (Mongoose)

---

## ⚙️ Instalação e Configuração

1.  **Clonar o Repositório**:
    ```bash
    git clone https://github.com/mtziiinn/ticket.git
    cd ticket
    ```

2.  **Instalar Dependências**:
    ```bash
    npm install
    cd web && npm install
    ```

3.  **Configurar Variáveis de Ambiente**:
    Crie um arquivo `.env` na raiz com:
    ```env
    BOT_TOKEN=seu_token_aqui
    MONGO_URI=sua_uri_mongodb
    WEB_URL=https://seu-site-aqui.vercel.app
    ```

4.  **Iniciar o Sistema**:
    ```bash
    npm run dev
    ```

---

## 📂 Estrutura do Projeto

*   `/src`: Código fonte do Bot do Discord.
*   `/src/discord/responders`: Lógica interativa de botões e modais.
*   `/web`: Aplicação Next.js para os Transcripts Online.
*   `/web/components/transcript`: Componentes visuais do site de logs.

---

<p align="center">
  Criado com ❤️ por <b>Mts</b><br>
</p>
