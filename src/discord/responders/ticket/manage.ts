import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createSection,
  createEmbed,
  Separator,
  createRow,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  LabelBuilder,
  TextChannel,
  PermissionFlagsBits,
  RadioGroupBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { db } from "#database";
import { env } from "#env";

// Mapeamento de Status de Encomenda
const statusMap: Record<
  string,
  { emoji: string; label: string; description: string }
> = {
  open: {
    emoji: "🔴",
    label: "Ticket Aberto",
    description:
      "Estamos conversando sobre sua encomenda e alinhando os detalhes.",
  },
  payment: {
    emoji: "🟡",
    label: "Pagamento Iniciado",
    description:
      "A primeira parte do pagamento foi realizada e o prazo de entrega já está contando.",
  },
  production: {
    emoji: "🟠",
    label: "Em produção",
    description:
      "Sua encomenda começou a ser feita e o processo será compartilhado para aprovação.",
  },
  completed: {
    emoji: "🟢",
    label: "Concluída",
    description: "Encomenda finalizada e entregue.",
  },
  queue: {
    emoji: "🟣",
    label: "Fila",
    description: "Atualmente se encontra em fila de espera.",
  },
};

// Função para gerar o painel principal (Assumir ou Painel Admin)
function createMainPanel(ticket: any, owner: any) {
  const isClaimed = !!ticket.claimedBy;
  const currentStatus = statusMap[ticket.status || "open"] || statusMap.open;

  return createContainer(
    constants.colors.azoxo,
    createSection({
      content:
        `## <:other_ticket:1502789959378145300> Ticket ${ticket.ticketId}\n${owner || "Usuário"} Seja bem-vindo(a) ao seu ticket! Através deste canal, a equipe irá realizar seu atendimento e esclarecer suas dúvidas.` +
        (isClaimed
          ? `\n\n> <:user_check:1502789974276178121> **Assumido por:** <@${ticket.claimedBy}>`
          : ""),
      thumbnail: (owner?.displayAvatarURL?.() ||
        "https://cdn.discordapp.com/embed/avatars/0.png") as any,
    }),
    Separator.Default,
    `### ${currentStatus.emoji} Status do Pedido: \`${currentStatus.label.toUpperCase()}\` \n> ${currentStatus.description}`,
    Separator.Default,
    `<:folder_open:1502789875928400103> **Categoria do atendimento:**\n\`\`\`\n${ticket.category.toUpperCase()}\n\`\`\``,
    `<:action_info:1502789798983766016> **Motivo do contato:**\n\`\`\`\n${ticket.description}\n\`\`\``,
    Separator.Default,
    isClaimed
      ? createRow(
          new ButtonBuilder({
            customId: "ticket/manage/admin",
            label: "Painel Admin",
            style: ButtonStyle.Secondary,
            emoji: "1502789931808981012",
          }),
          new ButtonBuilder({
            customId: "ticket/manage/close_modal", // Abre o modal diretamente
            label: "Finalizar Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789802918150206",
          }),
        )
      : createRow(
          new ButtonBuilder({
            customId: "ticket/manage/claim",
            label: "Assumir Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789940612698192",
          }),
          new ButtonBuilder({
            customId: "ticket/manage/admin",
            label: "Painel Admin",
            style: ButtonStyle.Secondary,
            emoji: "1502789931808981012",
          }),
        ),
    !isClaimed
      ? createRow(
          new ButtonBuilder({
            customId: "ticket/manage/close_modal", // Abre o modal diretamente
            label: "Finalizar Ticket",
            style: ButtonStyle.Secondary,
            emoji: "1502789802918150206",
          }),
        )
      : [],
  );
}

createResponder({
  customId: "ticket/manage/:action",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction, { action }) {
    const { channel, user, guild } = interaction;

    if (!channel?.isTextBased()) return;

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.reply({
        content:
          "Este canal não é um ticket válido ou não está no banco de dados.",
        flags: ["Ephemeral"],
      });
      return;
    }

    switch (action) {
      case "claim": {
        if (ticket.claimedBy) {
          await interaction.reply({
            content: `Este ticket já foi assumido por <@${ticket.claimedBy}>!`,
            flags: ["Ephemeral"],
          });
          return;
        }

        ticket.claimedBy = user.id;
        await (ticket as any).save();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        const container = createMainPanel(ticket, owner);

        await interaction.update({
          components: [container],
        });

        // Notificação Automática por DM
        if (owner) {
          const dmContainer = createContainer(
            constants.colors.azoxo,
            createSection({
              content: `### Notificação de Atendimento\nOlá ${owner}, seu ticket na categoria \`${ticket.category.toUpperCase()}\` foi assumido por ${user}. Ele agora é o responsável pelo seu atendimento. Vá até o ticket para dar continuidade ao seu atendimento.`,
              thumbnail: user.displayAvatarURL() as any,
            }),
            createRow(
              new ButtonBuilder({
                label: "Ir para o atendimento",
                style: ButtonStyle.Link,
                url: `https://discord.com/channels/${guild.id}/${channel.id}`,
              }),
            ),
          );

          await owner
            .send({
              components: [dmContainer],
              flags: ["IsComponentsV2"],
            })
            .catch(() => {});
        }
        break;
      }

      case "admin": {
        const isTheClaimer = ticket.claimedBy === user.id;

        const container = createContainer(
          "#3b82f6",
          createSection({
            content: `## <:shield:1502789938532450304> Painel Administrativo ${ticket.ticketId}\nSeja muito bem-vindo(a) ao Painel Administrativo! Este é o seu ambiente de controle, onde você pode gerenciar o atendimento atual. Caso tenha alguma dúvida sobre o funcionamento, entre em contato com a equipe responsável.`,
            thumbnail: user.displayAvatarURL() as any,
          }),
          Separator.Default,
          createSection({
            content: `● **Gerenciar usuário**\nNesta opção você pode adicionar/remover usuários do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/members_modal",
              label: "Gerenciar",
              style: ButtonStyle.Secondary,
              emoji: "1502789976327327801",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Renomar**\nNesta opção você pode alterar o nome do atendimento para ter melhor controle.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/rename_modal",
              label: "Renomear",
              style: ButtonStyle.Secondary,
              emoji: "1502789881250709675",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Notificar**\nNesta opção será enviada uma mensagem no privado do autor do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/notify",
              label: "Notificar",
              style: ButtonStyle.Secondary,
              emoji: "1502789798983766016",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Transferir Atendimento**\nNesta opção você pode alterar a categoria do atendimento.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/transfer",
              label: "Transferir",
              style: ButtonStyle.Secondary,
              emoji: "1502789875928400103",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Status do Pedido**\nNesta opção você pode atualizar o progresso da encomenda atual.`,
            button: new ButtonBuilder({
              customId: "ticket/manage/status_menu",
              label: "Mudar Status",
              style: ButtonStyle.Secondary,
              emoji: "1502789856881938502",
            }),
          }),
          Separator.Default,
          createSection({
            content: `● **Largar Atendimento**\nNesta opção você pode deixar de ser o responsável pelo atendimento.`,
            button: isTheClaimer
              ? new ButtonBuilder({
                  customId: "ticket/manage/unclaim",
                  label: "Largar",
                  style: ButtonStyle.Secondary,
                  emoji: "1502789878339862660",
                })
              : new ButtonBuilder({
                  customId: "disabled",
                  label: "Largar",
                  style: ButtonStyle.Secondary,
                  emoji: "1502789878339862660",
                  disabled: true,
                }),
          }),
          Separator.Default,
          createRow(
            new ButtonBuilder({
              customId: "ticket/manage/transcript",
              label: "Gerar Transcript",
              style: ButtonStyle.Secondary,
              emoji: "1502789907511247010",
            }),
          ),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }

      case "transfer": {
        const guildData = await db.guilds.get(guild.id);
        const dynamicCategories = guildData.channels?.ticketCategories || [];

        if (dynamicCategories.length === 0) {
          await interaction.reply({
            content: "❌ Nenhuma categoria configurada para transferência.",
            flags: ["Ephemeral"],
          });
          return;
        }

        const container = createContainer(
          constants.colors.primary,
          createSection({
            content:
              "### <:arrow_right:1502789809142239243> Transferir Ticket\nSelecione a nova categoria para este atendimento abaixo.",
            thumbnail: user.displayAvatarURL() as any,
          }),
          createRow(
            new StringSelectMenuBuilder({
              customId: "ticket/manage/transfer_select",
              placeholder: "Escolha uma categoria...",
              options: dynamicCategories.map((cat) => ({
                label: cat.name as string,
                value: cat.value as string,
                emoji: cat.emoji || undefined,
              })),
            }),
          ),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }

      case "unclaim": {
        if (ticket.claimedBy !== user.id) {
          await interaction.reply({
            content: "Apenas quem assumiu o ticket pode largá-lo.",
            flags: ["Ephemeral"],
          });
          return;
        }

        ticket.claimedBy = undefined;
        await (ticket as any).save();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        const container = createMainPanel(ticket, owner);

        if (ticket.messageId) {
          const mainMessage = await channel.messages
            .fetch(ticket.messageId)
            .catch(() => null);
          if (mainMessage) {
            await mainMessage.edit({ components: [container] }).catch(() => {});
          }
        }

        await interaction.reply({
          content: `<:action_check:1502789974276178121> Você largou o atendimento deste ticket.`,
          flags: ["Ephemeral"],
        });
        break;
      }

      case "status_menu": {
        const options = Object.entries(statusMap).map(
          ([value, { emoji, label }]) => ({
            label,
            value,
            emoji,
          }),
        );

        const container = createContainer(
          constants.colors.primary,
          createSection({
            content:
              "### <:clock_check:1502789856881938502> Atualizar Status do Pedido\nSelecione o novo status para esta encomenda abaixo. O usuário e o painel principal serão atualizados.",
            thumbnail: user.displayAvatarURL() as any,
          }),
          createRow(
            new StringSelectMenuBuilder({
              customId: "ticket/manage/status_select",
              placeholder: "Escolha o novo status...",
              options,
            }),
          ),
        );

        await interaction.reply({
          components: [container],
          flags: ["Ephemeral", "IsComponentsV2"],
        });
        break;
      }

      case "notify": {
        await interaction.deferReply({ flags: ["Ephemeral"] });

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        if (!owner) {
          await interaction.editReply({
            content: "Não foi possível encontrar o dono do ticket.",
          });
          return;
        }

        const embed = createEmbed({
          title: `<:bell:1502789830155702333> Notificação de Ticket`,
          description: `Olá ${owner}, um membro da nossa equipe está chamando você em seu ticket!`,
          fields: [
            { name: "Ticket", value: `${channel}`, inline: true },
            { name: "Servidor", value: `${guild.name}`, inline: true },
          ],
          color: constants.colors.azoxo,
          timestamp: new Date(),
          footer: { text: "Por favor, responda assim que possível." },
        });

        const success = await owner.send({ embeds: [embed] }).catch(() => null);

        if (success) {
          await interaction.editReply({
            content: `<:action_check:1502789797821939752> O dono do ticket foi notificado com sucesso via DM!`,
          });
        } else {
          await interaction.editReply({
            content: `❌ Não foi possível enviar a DM (Usuário com DMs fechadas). Mencione-o aqui no canal: ${owner}`,
          });
        }
        break;
      }

      case "close_confirm":
      case "close_modal": {
        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/close_submit")
          .setTitle("Finalizar Atendimento");

        const transcriptLabel = new LabelBuilder()
          .setLabel("Transcript:")
          .setDescription("Deseja salvar o histórico deste atendimento?")
          .setRadioGroupComponent(
            new RadioGroupBuilder().setCustomId("transcript_choice").setOptions(
              {
                label: "Salvar Transcript",
                value: "yes",
                description: "O log será gerado e enviado para a Staff.",
              },
              {
                label: "Não Salvar Transcript",
                value: "no",
                description: "O ticket será fechado sem gerar log público.",
              },
            ),
          );

        const considerationsLabel = new LabelBuilder()
          .setLabel("Considerações Finais:")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("considerations")
              .setPlaceholder("Escreva aqui as considerações finais...")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          );

        modal.addComponents(transcriptLabel, considerationsLabel);
        await interaction.showModal(modal);
        break;
      }

      case "members":
      case "members_modal": {
        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/members/submit")
          .setTitle("Gerenciar Membros");

        const label = new LabelBuilder()
          .setLabel("ID do Usuário")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("member")
              .setPlaceholder("Insira o ID do usuário (ex: 1234567890)")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          );

        modal.addComponents(label);
        await interaction.showModal(modal).catch((e) => console.error(e));
        break;
      }

      case "rename_modal": {
        const modal = new ModalBuilder()
          .setCustomId("ticket/manage/rename_submit")
          .setTitle("Renomear Ticket");

        const label = new LabelBuilder()
          .setLabel("Novo Nome")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("new_name")
              .setPlaceholder("ex: suporte-urgente")
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          );

        modal.addComponents(label);
        await interaction.showModal(modal).catch((e) => console.error(e));
        break;
      }

      case "close": {
        if (ticket.closed) {
          await interaction.reply({
            content: "Este ticket já está fechado!",
            flags: ["Ephemeral"],
          });
          return;
        }
        await interaction.reply({
          content:
            "Por favor, use o botão de finalizar para abrir o formulário.",
          flags: ["Ephemeral"],
        });
        break;
      }

      case "delete": {
        await interaction.reply({
          content: "Gerando transcript e deletando o canal...",
          flags: ["Ephemeral"],
        });

        ticket.closed = true;
        await (ticket as any).save();

        const guildData = await db.guilds.get(guild.id);
        const logChannelId = guildData.channels?.tickets;

        const transcriptUrl = await generateTranscript(
          channel as any,
          ticket,
          user,
        );

        if (logChannelId) {
          const logChannel = guild.channels.cache.get(logChannelId);
          if (logChannel?.isTextBased()) {
            const owner = await guild.members
              .fetch(ticket.ownerId)
              .catch(() => null);

            const claimer = ticket.claimedBy
              ? await guild.members.fetch(ticket.claimedBy).catch(() => null)
              : null;
            const openedAtTimestamp = Math.floor(
              ticket.openedAt.getTime() / 1000,
            );
            const closedAtTimestamp = Math.floor(new Date().getTime() / 1000);

            const logContainer = createContainer(
              "#3b82f6",
              createSection({
                content: `## <:folder:1502789880214720533> Atendimento Deletado: ${ticket.ticketId}\nO atendimento \`${ticket.ticketId}\` foi deletado por ${user}. O histórico de mensagens foi salvo e pode ser acessado abaixo.`,
                thumbnail: owner?.displayAvatarURL() as any,
              }),
              Separator.Default,
              `**Identificação**\n` +
                [
                  `<:user:1502789979229913268> **Aberto por:** ${owner || "Desconhecido"} (\`${ticket.ownerId}\`)`,
                  `<:action_remove:1502789800967536741> **Deletado por:** ${user} (\`${user.id}\`)`,
                  `<:user_check:1502789974276178121> **Assumido por:** ${claimer || "Ninguém"} (\`${ticket.claimedBy || "0"}\`)`,
                ].join("\n"),
              Separator.Default,
              `**Cronologia**\n` +
                [
                  `<:clock:1502789859960422502> **Aberto em:** <t:${openedAtTimestamp}:f> (<t:${openedAtTimestamp}:R>)`,
                  `<:clock:1502789859960422502> **Encerrado em:** <t:${closedAtTimestamp}:f> (<t:${closedAtTimestamp}:R>)`,
                ].join("\n"),
              Separator.Default,
              `**Detalhes do Ticket**\n` +
                [
                  `<:folder_open:1502789875928400103> **Categoria:** \`${ticket.category}\``,
                  `<:action_info:1502789798983766016> **Motivo:** \`${ticket.description || "Não informado."}\``,
                ].join("\n"),
              createRow(
                new ButtonBuilder({
                  label: "Acessar Transcript",
                  style: ButtonStyle.Link,
                  emoji: "1502789882916110407",
                  url: transcriptUrl,
                }),
              ),
            );

            await logChannel.send({
              components: [logContainer],
              flags: ["IsComponentsV2"],
            });
          }
        }

        setTimeout(() => channel.delete().catch(() => {}), 5000);
        break;
      }

      case "reopen": {
        await interaction.deferReply();

        const owner = await guild.members
          .fetch(ticket.ownerId)
          .catch(() => null);
        if (owner) {
          await (channel as any).permissionOverwrites.edit(owner.id, {
            SendMessages: true,
            ViewChannel: true,
          });
        }

        ticket.closed = false;
        ticket.closedBy = undefined;
        ticket.closedAt = undefined;
        await (ticket as any).save();

        await interaction.editReply({
          content: "🔓 Ticket reaberto com sucesso!",
        });
        break;
      }

      case "transcript": {
        await interaction.deferReply({ flags: ["Ephemeral"] });
        const transcriptUrl = await generateTranscript(
          channel as any,
          ticket,
          user,
        );

        const container = createContainer(
          constants.colors.secondary,
          createSection({
            content: `### Transcript Gerado\nO histórico de mensagens deste ticket foi processado com sucesso e está disponível online.`,
            thumbnail: emojis.static.file_files as any,
          }),
          createRow(
            new ButtonBuilder({
              label: "Abrir Transcript Online",
              style: ButtonStyle.Link,
              url: transcriptUrl,
            }),
          ),
        );

        await interaction.editReply({
          components: [container],
          flags: ["IsComponentsV2"],
        });
        break;
      }

      default: {
        await interaction.reply({
          content: `Ação "${action}" ainda não implementada.`,
          flags: ["Ephemeral"],
        });
      }
    }
  },
});

createResponder({
  customId: "ticket/manage/transfer_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { guild, channel, values, user } = interaction;
    if (!channel?.isTextBased()) return;

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) {
      await interaction.editReply({ content: "Ticket não encontrado." });
      return;
    }

    const newCategory = values[0];
    const guildData = await db.guilds.get(guild.id);
    const dynamicCategories = guildData.channels?.ticketCategories || [];
    const selectedCategory = dynamicCategories.find(
      (c) => c.value === newCategory,
    );

    const parentId = selectedCategory?.parentId;

    if (!parentId) {
      await interaction.editReply({
        content: `A categoria "${newCategory.toUpperCase()}" não está configurada corretamente.`,
      });
      return;
    }

    try {
      // 1. Atualizar canal no Discord
      await (channel as any).setParent(parentId, { lockPermissions: false });

      // 2. Atualizar banco de dados
      ticket.category = newCategory;
      await (ticket as any).save();

      // 3. Feedback
      await interaction.editReply({
        content: `<:action_check:1502789974276178121> Ticket transferido para a categoria **${newCategory.toUpperCase()}** com sucesso!`,
      });

      // Log no canal
      await channel.send({
        content: `<:action_info:1502789798983766016> Este ticket foi transferido para a categoria **${newCategory.toUpperCase()}** por ${user}.`,
      });
    } catch (error) {
      console.error("[Ticket] Erro ao transferir ticket:", error);
      await interaction.editReply({
        content:
          "Ocorreu um erro ao tentar mover o canal para a nova categoria.",
      });
    }
  },
});

export async function generateTranscript(
  channel: TextChannel,
  ticket: any,
  closer: any,
) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = [...messages.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );

  const guildData = await db.guilds.get(channel.guild.id);
  const vaultChannelId = guildData.channels?.vault;
  const vaultChannel = vaultChannelId
    ? channel.guild.channels.cache.get(vaultChannelId)
    : null;

  const ownerMember = await channel.guild.members
    .fetch(ticket.ownerId)
    .catch(() => null);

  const transcriptId =
    ticket.ticketId || Math.random().toString(36).substring(2, 9).toUpperCase();

  const messagesData = [];

  for (const msg of sortedMessages) {
    const attachments = [];

    if (msg.attachments.size > 0 && vaultChannel?.isTextBased()) {
      for (const att of msg.attachments.values()) {
        try {
          const backup = await (vaultChannel as any).send({
            content: `📦 **Backup de Mídia**\nTicket: \`${transcriptId}\` | Autor: \`${msg.author.tag}\``,
            files: [att.url],
          });
          const permanentUrl = backup.attachments.first()?.url;
          attachments.push({
            url: permanentUrl || att.url,
            filename: att.name,
            contentType: att.contentType,
          });
        } catch (err) {
          console.error(`[Vault] Erro ao fazer backup de ${att.name}:`, err);
          attachments.push({
            url: att.url,
            filename: att.name,
            contentType: att.contentType,
          });
        }
      }
    } else {
      attachments.push(
        ...msg.attachments.map((att) => ({
          url: att.url,
          filename: att.name,
          contentType: att.contentType,
        })),
      );
    }

    messagesData.push({
      id: `${transcriptId}-${messagesData.length}`,
      messageId: msg.id,
      authorId: msg.author.id,
      authorUsername: msg.author.username,
      authorAvatar: msg.author.displayAvatarURL(),
      authorBot: msg.author.bot,
      isStaff:
        msg.member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        false,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      attachments,
      embeds: msg.embeds.map((emb) => ({
        title: emb.title || undefined,
        description: emb.description || undefined,
        color: emb.color || undefined,
      })),
    });
  }

  const transcriptData = {
    id: transcriptId,
    guildId: channel.guild.id,
    guildName: channel.guild.name,
    channelId: channel.id,
    channelName: channel.name,
    category: ticket.category || "Suporte",
    description: ticket.description || "Não informado.",
    createdAt: ticket.openedAt
      ? new Date(ticket.openedAt).toISOString()
      : new Date().toISOString(),
    closedAt: new Date().toISOString(),
    openedBy: {
      id: ticket.ownerId,
      username: ownerMember?.user.username || "Desconhecido",
      avatar:
        ownerMember?.displayAvatarURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png",
    },
    closedBy: {
      id: closer.id,
      username: closer.username,
      avatar: closer.displayAvatarURL(),
    },
    messageCount: sortedMessages.length,
    messages: messagesData,
  };

  // Salvar no Banco de Dados (Sincronizado com o Web App)
  await db.transcripts.updateOne(
    { id: transcriptId },
    { $set: transcriptData },
    { upsert: true },
  );

  return `${env.WEB_URL}/transcripts/${transcriptId}`;
}

// Responder para seleção de status
createResponder({
  customId: "ticket/manage/status_select",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction) {
    const { values, channel, guild, user } = interaction;
    if (!channel?.isTextBased()) return;

    await interaction.deferUpdate();

    const ticket = await db.tickets.getByChannel(channel.id);
    if (!ticket) return;

    const newStatus = values[0];
    const statusData = statusMap[newStatus];

    ticket.status = newStatus;
    await (ticket as any).save();

    // Atualizar Painel Principal
    const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
    const container = createMainPanel(ticket, owner);

    if (ticket.messageId) {
      const mainMessage = await channel.messages
        .fetch(ticket.messageId)
        .catch(() => null);
      if (mainMessage) {
        await mainMessage.edit({ components: [container] }).catch(() => {});
      }
    }

    // Notificar no Canal
    await channel.send({
      content: `### ${statusData.emoji} Status Atualizado\nO status deste pedido foi alterado para: **${statusData.label.toUpperCase()}** por ${user}.\n> ${statusData.description}`,
    });

    await interaction.deleteReply().catch(() => {});
  },
});
