import { createCommand, createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createSection, createMediaGallery, createRow, Separator, } from "@magicyan/discord";
import { ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, } from "discord.js";
import { getEmojiTag } from "#functions";
const PERMISSION_NAMES = {
    AddReactions: "Adicionar reações",
    Administrator: "Administrador",
    AttachFiles: "Anexar arquivos",
    BanMembers: "Banir membros",
    ChangeNickname: "Alterar apelido",
    Connect: "Conectar",
    CreateInstantInvite: "Criar convites",
    CreatePrivateThreads: "Criar tópicos privados",
    CreatePublicThreads: "Criar tópicos públicos",
    DeafenMembers: "Ensurdecer membros",
    EmbedLinks: "Inserir links",
    KickMembers: "Expulsar Membros",
    ManageChannels: "Gerenciar canais",
    ManageEvents: "Gerenciar eventos",
    ManageGuild: "Gerenciar servidor",
    ManageMessages: "Gerenciar mensagens",
    ManageNicknames: "Gerenciar apelidos",
    ManageRoles: "Gerenciar cargos",
    ManageThreads: "Gerenciar tópicos",
    ManageWebhooks: "Gerenciar webhooks",
    MentionEveryone: "Mencionar everyone",
    ModerateMembers: "Moderar membros",
    MoveMembers: "Mover membros",
    MuteMembers: "Silenciar membros",
    PrioritySpeaker: "Voz prioritária",
    ReadMessageHistory: "Ler histórico de mensagens",
    RequestToSpeak: "Pedir para falar",
    SendMessages: "Enviar mensagens",
    SendMessagesInThreads: "Enviar mensagens em tópicos",
    SendTTSMessages: "Enviar mensagens em Texto-para-voz",
    Speak: "Falar",
    Stream: "Vídeo",
    UseApplicationCommands: "Usar comandos de aplicativos",
    UseEmbeddedActivities: "Usar atividades",
    UseExternalEmojis: "Emojis externos",
    UseExternalStickers: "Usar figurinhas externas",
    UseVAD: "Usar detecção de voz",
    ViewAuditLog: "Ver o registro de auditoria",
    ViewChannel: "Ler mensagens",
    ViewGuildInsights: "Ver análises do servidor",
    CreateGuildExpressions: "Criar expressões",
    ManageGuildExpressions: "Gerenciar expressões",
    SendVoiceMessages: "Enviar mensagens de voz",
    SendPolls: "Criar enquetes",
    UseSoundboard: "Usar soundboard",
    UseExternalSounds: "Usar sons externos",
};
function getAccentColor() {
    try {
        if (typeof constants !== "undefined" && constants.colors?.primary) {
            return constants.colors.primary;
        }
    }
    catch {
        // fallback
    }
    return "#38bdf8";
}
createCommand({
    name: "usuario",
    description: "Comandos de informações de usuário",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "info",
            description: "Exibe informações detalhadas de um usuário.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "usuario",
                    description: "Selecione o usuário (opcional)",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
            ],
        },
        {
            name: "avatar",
            description: "Exibe o avatar de um usuário.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "usuario",
                    description: "Selecione o usuário (opcional)",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
            ],
        },
        {
            name: "banner",
            description: "Exibe o banner de um usuário.",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "usuario",
                    description: "Selecione o usuário (opcional)",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
            ],
        },
    ],
    async run(interaction) {
        if (!interaction.inCachedGuild())
            return;
        const { options, guild } = interaction;
        const subcommand = options.getSubcommand();
        const targetUser = options.getUser("usuario") ?? interaction.user;
        const targetMember = guild.members.cache.get(targetUser.id) ??
            (await guild.members.fetch(targetUser.id).catch(() => null));
        const accentColor = getAccentColor();
        const displayName = targetUser.globalName ||
            targetMember?.displayName ||
            targetUser.displayName ||
            targetUser.username;
        if (subcommand === "info") {
            const avatarUrl = targetMember?.displayAvatarURL({ size: 1024 }) ||
                targetUser.displayAvatarURL({ size: 1024 });
            const createdTimestamp = Math.floor(targetUser.createdTimestamp / 1000);
            const joinedTimestamp = targetMember?.joinedTimestamp
                ? Math.floor(targetMember.joinedTimestamp / 1000)
                : null;
            const headerLine = `${getEmojiTag("user")} **Nome**\u3000\u3000\u3000\u3000${getEmojiTag("action_info")} **Identidade**\u3000\u3000\u3000\u3000${getEmojiTag("user_users")} **Menção**`;
            const valuesLine = `\`${targetUser.username}\`\u3000\`${targetUser.id}\`\u3000<@${targetUser.id}>`;
            const row = createRow(new ButtonBuilder({
                customId: `usuario/permissoes/${targetUser.id}`,
                label: "Permissões do Membro",
                style: ButtonStyle.Secondary,
            }));
            const container = createContainer(accentColor, createSection({
                content: [
                    `### **${displayName}**`,
                    `${headerLine}\n${valuesLine}`,
                ],
                thumbnail: avatarUrl,
            }), Separator.Default, `${getEmojiTag("calendar")} **Conta Criada**\n<t:${createdTimestamp}:f> ( <t:${createdTimestamp}:R> )`, Separator.Default, `${getEmojiTag("user_add")} **Entrou em**\n${joinedTimestamp
                ? `<t:${joinedTimestamp}:f> ( <t:${joinedTimestamp}:R> )`
                : "*Não está no servidor*"}`, Separator.Default, row);
            await interaction.reply({
                components: [container],
                flags: ["Ephemeral", "IsComponentsV2"],
            });
            return;
        }
        if (subcommand === "avatar") {
            const avatarUrl = targetMember?.displayAvatarURL({ size: 4096 }) ||
                targetUser.displayAvatarURL({ size: 4096 });
            const row = createRow(new ButtonBuilder({
                label: "Abrir no navegador",
                style: ButtonStyle.Link,
                url: avatarUrl,
            }));
            const container = createContainer(accentColor, `### **Avatar de ${displayName}**`, createMediaGallery(avatarUrl), Separator.Default, row);
            await interaction.reply({
                components: [container],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        if (subcommand === "banner") {
            let bannerUrl = null;
            try {
                const fetchedUser = await interaction.client.users.fetch(targetUser.id, { force: true });
                bannerUrl =
                    targetMember?.bannerURL({ size: 4096 }) ||
                        fetchedUser.bannerURL({ size: 4096 });
            }
            catch {
                bannerUrl =
                    targetMember?.bannerURL({ size: 4096 }) ||
                        targetUser.bannerURL({ size: 4096 });
            }
            if (bannerUrl) {
                const row = createRow(new ButtonBuilder({
                    label: "Abrir no navegador",
                    style: ButtonStyle.Link,
                    url: bannerUrl,
                }));
                const container = createContainer(accentColor, `### **Banner de ${displayName}**`, createMediaGallery(bannerUrl), Separator.Default, row);
                await interaction.reply({
                    components: [container],
                    flags: ["IsComponentsV2"],
                });
                return;
            }
            const fallbackContainer = createContainer(accentColor, `### **Banner de ${displayName}**`, Separator.Default, `*Este usuário não possui um banner configurado.*`);
            await interaction.reply({
                components: [fallbackContainer],
                flags: ["Ephemeral", "IsComponentsV2"],
            });
            return;
        }
    },
});
createResponder({
    customId: "usuario/permissoes/:userId",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction, { userId }) {
        const targetMember = interaction.guild.members.cache.get(userId) ??
            (await interaction.guild.members.fetch(userId).catch(() => null));
        if (!targetMember) {
            await interaction.reply({
                content: "Este membro não se encontra mais no servidor.",
                flags: ["Ephemeral"],
            });
            return;
        }
        const highestRole = targetMember.roles.highest.id === interaction.guild.id
            ? "@everyone"
            : `<@&${targetMember.roles.highest.id}>`;
        const permissionsList = targetMember.permissions
            .toArray()
            .map((perm) => PERMISSION_NAMES[perm])
            .filter((name) => Boolean(name))
            .sort((a, b) => a.localeCompare(b, "pt-BR"))
            .map((name) => `\`${name}\``)
            .join(", ");
        const accentColor = getAccentColor();
        const displayName = targetMember.displayName ||
            targetMember.user.displayName ||
            targetMember.user.username;
        const permContainer = createContainer(accentColor, `${getEmojiTag("shield")} **Maior Cargo**\n${highestRole}`, Separator.Default, `${getEmojiTag("lock")} **Permissões de ${displayName}**\n${permissionsList || "*Nenhuma permissão específica.*"}`);
        await interaction.reply({
            components: [permContainer],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});
