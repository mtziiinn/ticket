import { env } from "#env";
import { bootstrap } from "@constatic/base";
import { db } from "#database";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import "./constants.js";
import { GatewayIntentBits, Options, Partials } from "discord.js";
import { clearBotCache } from "#functions";

console.log("------------------------------------------");
console.log("BOT INICIANDO - SISTEMA DE TICKETS ATIVO");
console.log("------------------------------------------");

const { client } = await bootstrap({
  meta: import.meta,
  env,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember],
  makeCache: Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: 100,
    UserManager: 50,
    GuildMemberManager: 100,
    PresenceManager: 0,
    ReactionManager: 0,
    ThreadManager: 0,
    VoiceStateManager: 50,
    ApplicationCommandManager: 0,
    BaseGuildEmojiManager: 50,
    GuildEmojiManager: 50,
    GuildInviteManager: 0,
    GuildStickerManager: 0,
    GuildScheduledEventManager: 0,
    StageInstanceManager: 0,
  }),
  sweepers: {
    ...Options.DefaultSweeperSettings,
    messages: {
      interval: 300,
      lifetime: 600,
    },
    users: {
      interval: 600,
      filter: () => (user: any) => user.id !== client?.user?.id,
    },
    guildMembers: {
      interval: 600,
      filter: () => (member: any) => member.id !== client?.user?.id,
    },
  },
});

async function cleanupOldTranscripts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.transcripts.deleteMany({
      createdAt: { $lt: thirtyDaysAgo.toISOString() },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[Cleanup] ${result.deletedCount} transcripts antigos removidos`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar transcripts:", error);
  }
}

async function cleanupOldDeliveries() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.tickets.updateMany(
      {},
      { $pull: { deliveries: { deliveredAt: { $lt: thirtyDaysAgo } } } },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[Cleanup] ${result.modifiedCount} tickets tiveram entregas antigas removidas`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar entregas:", error);
  }
}

async function cleanupPendingDeliveries() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await db.pendingDeliveries.deleteMany({
      createdAt: { $lt: sevenDaysAgo },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[Cleanup] ${result.deletedCount} pending deliveries expirados removidos`,
      );
    }
  } catch (error) {
    console.error("[Cleanup] Erro ao limpar pending deliveries:", error);
  }
}

async function processDmQueue() {
  try {
    const queue = await db.dmQueue
      .find()
      .sort({ createdAt: 1 })
      .limit(5)
      .lean();
    for (const item of queue) {
      try {
        const user = await client.users.fetch(item.ownerId);
        const staff = await client.users.fetch(item.staffId);

        const fileLine =
          item.fileCount && item.fileCount > 1
            ? `<:file_add:1502789905112105071> **${item.fileCount} arquivos compactados em ZIP:** \`${item.filename}\``
            : `<:file_add:1502789905112105071> **Arquivo:** \`${item.filename}\``;

        const dmContainer = createContainer(
          constants.colors.primary,
          createSection({
            content: `### <:file_check:1502789906122936431> Mídia Entregue!\nOlá ${user}, o arquivo final do seu pedido foi entregue!`,
            thumbnail: staff.displayAvatarURL() as any,
          }),
          Separator.Default,
          fileLine,
          `<:clipboard:1502789887907205293> **Descrição:** ${item.description || "Mídia entregue"}`,
          `<:cloud_check:1502789867355115690> **Link:** ${item.downloadUrl}`,
          Separator.Default,
          `<:action_warning:1502789801949265990> O link expira em **7 dias**.`,
        );

        await user.send({
          components: [dmContainer],
          flags: ["IsComponentsV2"],
        });
        console.log(
          `[DM Queue] DM enviada para ${item.ownerId} (${item.filename})`,
        );
      } catch (err) {
        console.error(
          `[DM Queue] Erro ao enviar DM para ${item.ownerId}:`,
          err,
        );
        try {
          const channel = await client.channels.fetch(item.channelId);
          if (channel?.isTextBased() && "send" in channel) {
            await (channel as any).send(
              `<@${item.ownerId}> 📬 Sua mídia foi entregue! ${item.downloadUrl}`,
            );
          }
        } catch {
          /* ignora */
        }
      }
      await db.dmQueue.deleteOne({ _id: item._id });
    }
  } catch (error) {
    console.error("[DM Queue] Erro no processamento:", error);
  }
}

async function runAllCleanups() {
  try {
    console.log("[Cleanup] Iniciando rotina de limpezas...");
    await cleanupOldTranscripts();
    await cleanupOldDeliveries();
    await cleanupPendingDeliveries();
    console.log("[Cleanup] Rotina de limpezas concluída.");
  } catch (error) {
    console.error("[Cleanup] Erro na rotina de limpezas:", error);
  }
}

// Executa limpezas iniciais de forma assíncrona
runAllCleanups().catch((err) => console.error("[Cleanup] Erro inicial:", err));

function runPeriodicCacheCleanup() {
  try {
    const res = clearBotCache(client);
    console.log(
      `[Cache] Limpeza periódica concluída | Msgs: ${res.messagesSwept}, Users: ${res.usersSwept}, Membros: ${res.membersSwept} | Heap: ${res.heapUsedAfterMB}MB (-${res.heapDiffMB}MB) | RSS: ${res.rssAfterMB}MB`,
    );
  } catch (error) {
    console.error("[Cache] Erro na limpeza periódica:", error);
  }
}

// Configura intervalos
setInterval(runAllCleanups, 6 * 60 * 60 * 1000);
setInterval(processDmQueue, 10000);
setInterval(runPeriodicCacheCleanup, 15 * 60 * 1000); // A cada 15 minutos
