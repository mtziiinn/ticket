import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  createContainer,
  createRow,
  Separator,
} from "@magicyan/discord";
import { db } from "#database";

function parseDuration(str: string): number | null {
  const match = str.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === "s") return val * 1000;
  if (unit === "m") return val * 60 * 1000;
  if (unit === "h") return val * 60 * 60 * 1000;
  if (unit === "d") return val * 24 * 60 * 60 * 1000;
  return null;
}

export function pickRandomWinners(
  participants: string[],
  count: number,
): string[] {
  if (participants.length === 0) return [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function finishGiveaway(
  giveawayDoc: any,
  client: Client,
): Promise<string[]> {
  giveawayDoc.ended = true;

  const winners = pickRandomWinners(
    giveawayDoc.participants || [],
    giveawayDoc.winnersCount || 1,
  );
  giveawayDoc.winners = winners;
  await giveawayDoc.save();

  try {
    const channel = client.channels.cache.get(giveawayDoc.channelId);
    if (channel && channel.isTextBased()) {
      const msg = await channel.messages
        .fetch(giveawayDoc.messageId)
        .catch(() => null);

      const winnersText =
        winners.length > 0
          ? winners.map((id) => `<@${id}>`).join(", ")
          : "*Nenhum participante válido.*";

      const updatedContainer = createContainer(
        "#22c55e",
        `## 🎉 Sorteio Finalizado: ${giveawayDoc.item}`,
        Separator.Default,
        `| **Ganhadores (${winners.length}):**\n${winnersText}`,
        Separator.Default,
        `*Sorteio encerrado em <t:${Math.floor(Date.now() / 1000)}:R>*`,
      );

      if (msg) {
        await msg.edit({
          components: [updatedContainer],
          flags: ["IsComponentsV2"] as any,
        });
      }

      if (winners.length > 0) {
        const announceContainer = createContainer(
          "#22c55e",
          `| **Parabéns ${winnersText}!**\nVocê(s) ganhou/ganharam **${giveawayDoc.item}** no sorteio!`,
        );

        await (channel as any).send({
          components: [announceContainer],
          flags: ["IsComponentsV2"],
        });
      }
    }
  } catch (err) {
    console.error("[Giveaway] Erro ao finalizar sorteio:", err);
  }

  return winners;
}

createCommand({
  name: "criar-sorteio",
  description: "🎁 Inicia um novo sorteio interativo no canal.",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  options: [
    {
      name: "item",
      description: "Nome do item ou prêmio a ser sorteado.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "ganhadores",
      description: "Quantidade de vencedores do sorteio.",
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 25,
      required: true,
    },
    {
      name: "tempo",
      description: "Duração do sorteio (ex: 30m, 1h, 1d).",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async run(interaction) {
    if (!interaction.inCachedGuild()) return;

    const item = interaction.options.getString("item", true);
    const winnersCount = interaction.options.getInteger("ganhadores", true);
    const durationStr = interaction.options.getString("tempo", true);

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 10000) {
      await interaction.reply({
        content:
          "⚠️ Duração inválida! Use formatos como `10m`, `1h`, `2d` (mínimo de 10 segundos).",
        flags: ["Ephemeral"],
      });
      return;
    }

    const endsAt = new Date(Date.now() + durationMs);
    const endTimestamp = Math.floor(endsAt.getTime() / 1000);

    await interaction.deferReply({ flags: ["Ephemeral"] });

    const tempContainer = createContainer(
      "#22c55e",
      `## 🎁 Sorteio: ${item}`,
      Separator.Default,
      `| **Quantidade de Ganhadores:** \`${winnersCount}\`\n**Encerramento:** <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)`,
      Separator.Default,
      `| Para participar, clique no botão abaixo!`,
      Separator.Default,
      createRow(
        new ButtonBuilder()
          .setCustomId("giveaway/join/pending")
          .setLabel("Participar")
          .setStyle(ButtonStyle.Success)
          .setEmoji("👤"),
        new ButtonBuilder()
          .setCustomId("giveaway/manage/pending")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⚙️"),
      ),
    );

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({
        content: "⚠️ Este comando só pode ser usado em canais de texto.",
      });
      return;
    }

    const message = await (channel as any).send({
      components: [tempContainer],
      flags: ["IsComponentsV2"],
    });

    const finalContainer = createContainer(
      "#22c55e",
      `## 🎁 Sorteio: ${item}`,
      Separator.Default,
      `| **Quantidade de Ganhadores:** \`${winnersCount}\`\n**Encerramento:** <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)`,
      Separator.Default,
      `| Para participar, clique no botão abaixo!`,
      Separator.Default,
      createRow(
        new ButtonBuilder()
          .setCustomId(`giveaway/join/${message.id}`)
          .setLabel("Participar")
          .setStyle(ButtonStyle.Success)
          .setEmoji("👤"),
        new ButtonBuilder()
          .setCustomId(`giveaway/manage/${message.id}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⚙️"),
      ),
    );

    await message.edit({
      components: [finalContainer],
      flags: ["IsComponentsV2"] as any,
    });

    await db.giveaways.create({
      messageId: message.id,
      channelId: channel.id,
      guildId: interaction.guild.id,
      item,
      winnersCount,
      endsAt,
      ended: false,
      participants: [],
      winners: [],
    });

    await interaction.editReply({
      content: "✅ Sorteio iniciado com sucesso!",
    });
  },
});

// 1. Participar do Sorteio
createResponder({
  customId: "giveaway/join/:messageId",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction, { messageId }) {
    const giveaway = await db.giveaways.findOne({ messageId });
    if (!giveaway || giveaway.ended) {
      await interaction.reply({
        content: "⚠️ Este sorteio já foi finalizado ou não foi encontrado.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const userId = interaction.user.id;
    const isParticipating = giveaway.participants.includes(userId);

    if (isParticipating) {
      giveaway.participants = giveaway.participants.filter(
        (id: string) => id !== userId,
      );
      await giveaway.save();

      await interaction.reply({
        content: "👋 Você saiu do sorteio.",
        flags: ["Ephemeral"],
      });
    } else {
      giveaway.participants.push(userId);
      await giveaway.save();

      await interaction.reply({
        content: `🎉 Você agora está participando do sorteio de **${giveaway.item}**! Total de participantes: \`${giveaway.participants.length}\`.`,
        flags: ["Ephemeral"],
      });
    }
  },
});

// 2. Abrir Menu de Gerenciamento do Sorteio (⚙️)
createResponder({
  customId: "giveaway/manage/:messageId",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction, { messageId }) {
    if (
      !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        content: "⚠️ Apenas administradores podem gerenciar sorteios.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const giveaway = await db.giveaways.findOne({ messageId });
    if (!giveaway) {
      await interaction.reply({
        content: "⚠️ Sorteio não encontrado.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`giveaway/action/${messageId}`)
      .setPlaceholder("Selecione uma opção...")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue("edit_winners")
          .setLabel("Alterar Ganhadores")
          .setDescription("Modifica a quantidade de vencedores.")
          .setEmoji("✏️"),
        new StringSelectMenuOptionBuilder()
          .setValue("view_participants")
          .setLabel("Ver Participantes")
          .setDescription("Exibe a quantidade e lista de participantes.")
          .setEmoji("👤"),
        new StringSelectMenuOptionBuilder()
          .setValue("finish_now")
          .setLabel("Finalizar Agora")
          .setDescription(
            "Encerra o sorteio imediatamente e puxa os ganhadores.",
          )
          .setEmoji("🎁"),
        new StringSelectMenuOptionBuilder()
          .setValue("reroll")
          .setLabel("Reroll (Sortear Novamente)")
          .setDescription("Sorteia novos ganhadores para este sorteio.")
          .setEmoji("🔁"),
        new StringSelectMenuOptionBuilder()
          .setValue("delete")
          .setLabel("Excluir Sorteio")
          .setDescription("Cancela e deleta o sorteio.")
          .setEmoji("📁"),
      );

    const container = createContainer(
      "#22c55e",
      "## ⚙️ Gerenciar Sorteio",
      `Escolha uma ação abaixo:`,
      Separator.Default,
      createRow(select),
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"] as any,
    });
  },
});

// 3. Responder de Ações do Sorteio
createResponder({
  customId: "giveaway/action/:messageId",
  types: [ResponderType.StringSelect],
  cache: "cached",
  async run(interaction, { messageId }) {
    const action = interaction.values[0];
    const giveaway = await db.giveaways.findOne({ messageId });

    if (!giveaway) {
      await interaction.update({
        content: "⚠️ Sorteio não encontrado.",
        components: [],
      });
      return;
    }

    if (action === "view_participants") {
      const participants = giveaway.participants || [];
      const list =
        participants.length > 0
          ? participants
              .slice(0, 50)
              .map((id: string) => `<@${id}>`)
              .join(", ") +
            (participants.length > 50
              ? ` e mais ${participants.length - 50}...`
              : "")
          : "*Nenhum participante até o momento.*";

      const container = createContainer(
        "#22c55e",
        `## 👤 Participantes do Sorteio (${participants.length})`,
        Separator.Default,
        list,
      );

      await interaction.update({
        components: [container],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (action === "finish_now") {
      if (giveaway.ended) {
        await interaction.update({
          content: "⚠️ Este sorteio já está encerrado.",
          components: [],
        });
        return;
      }

      await finishGiveaway(giveaway, interaction.client);

      await interaction.update({
        components: [
          createContainer(
            "#22c55e",
            `| ✅ **Sorteio encerrado com sucesso.**`,
          ),
        ],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (action === "reroll") {
      const winners = pickRandomWinners(
        giveaway.participants || [],
        giveaway.winnersCount || 1,
      );

      if (winners.length === 0) {
        await interaction.update({
          content: "⚠️ Não há participantes suficientes para reroll.",
          components: [],
        });
        return;
      }

      giveaway.winners = winners;
      await giveaway.save();

      const winnersText = winners.map((id) => `<@${id}>`).join(", ");

      const channel = interaction.guild.channels.cache.get(giveaway.channelId);
      if (channel && channel.isTextBased()) {
        const announceContainer = createContainer(
          "#22c55e",
          `| 🔁 **Novo Sorteio (Reroll):**\nParabéns ${winnersText}! Você(s) foi(ram) sorteado(s) para **${giveaway.item}**!`,
        );
        await (channel as any).send({
          components: [announceContainer],
          flags: ["IsComponentsV2"],
        });
      }

      await interaction.update({
        components: [
          createContainer(
            "#22c55e",
            `| ✅ **Reroll realizado com sucesso:** ${winnersText}`,
          ),
        ],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (action === "delete") {
      await db.giveaways.deleteOne({ messageId });

      const channel = interaction.guild.channels.cache.get(giveaway.channelId);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages
          .fetch(messageId)
          .catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      await interaction.update({
        components: [
          createContainer("#ED4245", `| 🗑️ **Sorteio excluído com sucesso.**`),
        ],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (action === "edit_winners") {
      const modal = new ModalBuilder()
        .setCustomId(`giveaway/modal_edit_winners/${messageId}`)
        .setTitle("Alterar Quantidade de Ganhadores");

      const label = new LabelBuilder()
        .setLabel("Nova quantidade de ganhadores:")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("count")
            .setPlaceholder("Ex: 1, 2, 5...")
            .setValue(giveaway.winnersCount.toString())
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        );

      modal.addComponents(label);
      await interaction.showModal(modal);
      return;
    }
  },
});

// 4. Modal Alterar Ganhadores
createResponder({
  customId: "giveaway/modal_edit_winners/:messageId",
  types: [ResponderType.Modal, ResponderType.ModalComponent],
  cache: "cached",
  async run(interaction, { messageId }) {
    const countStr = interaction.fields.getTextInputValue("count");
    const count = parseInt(countStr, 10);

    if (isNaN(count) || count < 1 || count > 25) {
      await interaction.reply({
        content: "⚠️ Quantidade inválida! Escolha um número entre 1 e 25.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const giveaway = await db.giveaways.findOne({ messageId });
    if (!giveaway) {
      await interaction.reply({
        content: "⚠️ Sorteio não encontrado.",
        flags: ["Ephemeral"],
      });
      return;
    }

    giveaway.winnersCount = count;
    await giveaway.save();

    await interaction.reply({
      content: `✅ Quantidade de ganhadores atualizada para **${count}**!`,
      flags: ["Ephemeral"],
    });
  },
});
