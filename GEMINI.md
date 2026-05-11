# Project Instructions

- **Documentation**: Always consult the following documentation sites for any tasks:
  - [Discord Developer Documentation](https://docs.discord.com/developers/intro)
  - [Constatic Documentation](https://constatic-docs.vercel.app)

# Sistema de Tickets - Documentação do Projeto

## 🚀 Funcionalidades Implementadas
O sistema foi desenvolvido utilizando as tecnologias mais recentes do Discord (**Components V2** e **Modais V2**) via framework **Constatic**, com foco em uma identidade visual premium utilizando ícones customizados.

### 1. Sistema de Abertura (Painel Principal)
- **Comando**: `/ticket painel` - Envia o painel de abertura de tickets.
- **Visual**: Design moderno com `createContainer` (Azoxo), incluindo cabeçalho com ícone, texto de boas-vindas e uma lista de diretrizes numeradas com bullet points.
- **Formulário**: Modal interativo para seleção de categoria (com ícones customizados) e descrição do problema.

### 2. Roteamento e Transferência
- **Comando**: `/ticket configurar` - Define canal de logs e categorias de destino.
- **Lógica**: Criação automática em categorias específicas (*Suporte*, *Denúncia*, *Financeiro*, *Bugs*).
- **Transferência**: Staff pode mover o ticket entre categorias a qualquer momento via Painel Administrativo, atualizando o canal no Discord e os dados no banco.

### 3. Gerenciamento de Tickets (Painel Admin)
O Painel Administrativo foi redesenhado para um estilo "Dashboard" com seções e separadores:
- **Membros**: Gerenciamento de acessos (Adicionar/Remover).
- **Renomear**: Alteração dinâmica do nome do canal.
- **Notificar**: Envio de DM automática ao dono do ticket.
- **Transferir**: Menu de seleção para trocar a categoria do atendimento.
- **Largar/Assumir**: Sistema de claim para staff com feedback visual e logs.
- **Transcript**: Geração manual ou automática de logs.

### 4. Ciclo de Vida e Transcript Online
- **Finalização**: Processo com preenchimento de **Considerações Finais** e salvamento de log.
- **Transcript Web**: Sistema integrado com **Next.js** (`ticket-mts.vercel.app`).
- **Detalhes do Contato**: O site agora exibe o **Motivo da Abertura** escrito pelo usuário, além do resumo de mensagens.
- **Visual Logs**: Logs na Staff e na DM do usuário utilizam design limpo com separadores, cores azul (#3b82f6) e ícones de alta qualidade.

## 🛠️ Detalhes Técnicos
- **Banco de Dados**: MongoDB Atlas (Coleções: `guilds`, `tickets`, `transcripts`).
- **Framework Bot**: `@constatic/base` + `@magicyan/discord`.
- **Interface Web**: Next.js 14+ com Tailwind CSS e Lucide Icons.
- **Identidade Visual**: Uso extensivo de emojis customizados (`emojis.json`) e constantes de cores (`constants.json`).

## 📂 Estrutura de Arquivos Principais
- `src/discord/commands/staff/ticket.ts`: Configuração, Painel Principal e Roteamento.
- `src/discord/responders/ticket/submit.ts`: Lógica de abertura, Modais e Categorias.
- `src/discord/responders/ticket/manage.ts`: Painel Administrativo, Transferência e Geração de Dados de Transcript.
- `src/discord/responders/ticket/admin.ts`: Lógica de Finalização, Envio de Logs e DMs de encerramento.
- `web/`: Aplicação Next.js para visualização dos logs.
