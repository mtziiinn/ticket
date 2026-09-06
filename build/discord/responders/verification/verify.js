import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createContainer, createRow, Separator, createMediaGallery, } from "@magicyan/discord";
import { AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, } from "discord.js";
import { createCanvas } from "@napi-rs/canvas";
import { db } from "#database";
import { getEmojiTag } from "#functions";
import { getVerifyEmbedColor } from "../panel/panelView.js";
// Map temporário para armazenar códigos de captcha por usuário
// userId -> { code: string, expires: number }
const userCaptchas = new Map();
function generateCaptchaCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem O, 0, I, 1 para evitar ambiguidades
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function generateDecoyCode(correct) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const posToChange = Math.floor(Math.random() * correct.length);
    const newChar = chars.charAt(Math.floor(Math.random() * chars.length));
    const arr = correct.split("");
    arr[posToChange] = newChar;
    const decoy = arr.join("");
    return decoy === correct ? generateDecoyCode(correct) : decoy;
}
function generateCaptchaImage(code) {
    const width = 420;
    const height = 150;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    // Background escuro (#0e1013)
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(0, 0, width, height);
    // Borda sutil (#1a1d24)
    ctx.strokeStyle = "#1a1d24";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    // Efeito de linhas cibernéticas sutis de fundo
    ctx.strokeStyle = "rgba(34, 197, 94, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 20; x < width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 20; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    // Texto com brilho verde neon (igual ao print de referência)
    ctx.font = "bold 50px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const centerX = width / 2;
    const centerY = height / 2;
    // Camada 1: Glow difuso amplo
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#00e676";
    ctx.fillText(code, centerX, centerY);
    // Camada 2: Glow médio intenso
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#22c55e";
    ctx.fillText(code, centerX, centerY);
    // Camada 3: Núcleo do texto nítido
    ctx.shadowBlur = 2;
    ctx.fillStyle = "#4ade80";
    ctx.fillText(code, centerX, centerY);
    return canvas.toBuffer("image/png");
}
// 1. Informações de segurança
createResponder({
    customId: "verify/captcha/info",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const guildData = await db.guilds.get(interaction.guild.id);
        const verifyColor = getVerifyEmbedColor(guildData);
        const container = createContainer(verifyColor, `## ${getEmojiTag("shield_check")} Por que a verificação é necessária?`, Separator.Default, [
            `A verificação por captcha é uma medida de proteção essencial para manter nossa comunidade segura e agradável para todos os membros:`,
            ``,
            `• **Anti-Raid:** Impede que bots de spam e ataques em massa invadam os canais.`,
            `• **Segurança:** Garante que todos os participantes sejam usuários reais.`,
            `• **Proteção de Dados:** Preserva a integridade das conversas e atendimentos.`,
        ].join("\n"), Separator.Default, `*Basta clicar no botão **Verificar-se** e escolher o código correto para liberar seu acesso imediatamente!*`);
        await interaction.reply({
            components: [container],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});
// 2. Iniciar Captcha
createResponder({
    customId: "verify/captcha/start",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        const code = generateCaptchaCode(6);
        userCaptchas.set(interaction.user.id, {
            code,
            expires: Date.now() + 3 * 60 * 1000, // 3 minutos
        });
        const decoys = new Set();
        while (decoys.size < 4) {
            const d = generateDecoyCode(code);
            if (d !== code)
                decoys.add(d);
        }
        const allOptions = [code, ...Array.from(decoys)].sort(() => Math.random() - 0.5);
        const imageBuffer = generateCaptchaImage(code);
        const attachment = new AttachmentBuilder(imageBuffer, { name: "captcha.png" });
        const select = new StringSelectMenuBuilder()
            .setCustomId("verify/captcha/select")
            .setPlaceholder("Selecione o texto que é exibido na imagem...")
            .addOptions(allOptions.map((opt) => new StringSelectMenuOptionBuilder()
            .setLabel(opt)
            .setValue(opt)
            .setDescription("Clique para selecionar este texto.")
            .setEmoji("1502789932727668788")));
        const guildData = await db.guilds.get(interaction.guild.id);
        const verifyColor = getVerifyEmbedColor(guildData);
        const container = createContainer(verifyColor, createMediaGallery("attachment://captcha.png"), Separator.Default, createRow(select));
        await interaction.reply({
            components: [container],
            files: [attachment],
            flags: ["Ephemeral", "IsComponentsV2"],
        });
    },
});
// 3. Validação do Captcha
createResponder({
    customId: "verify/captcha/select",
    types: [ResponderType.StringSelect],
    cache: "cached",
    async run(interaction) {
        const selected = interaction.values[0];
        const session = userCaptchas.get(interaction.user.id);
        if (!session || session.expires < Date.now()) {
            await interaction.update({
                components: [
                    createContainer("#ED4245", `## ${getEmojiTag("clock")} Captcha Expirado`, "O tempo limite para resolver este captcha expirou. Clique no botão **Verificar-se** novamente para gerar um novo desafio."),
                ],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        if (selected !== session.code) {
            userCaptchas.delete(interaction.user.id);
            await interaction.update({
                components: [
                    createContainer("#ED4245", `## ${getEmojiTag("action_x")} Resposta Incorreta`, `O código selecionado (\`${selected}\`) não corresponde ao código gerado.\nClique no botão **Verificar-se** novamente para tentar um novo código.`),
                ],
                flags: ["IsComponentsV2"],
            });
            return;
        }
        // Sucesso!
        userCaptchas.delete(interaction.user.id);
        const guildData = await db.guilds.get(interaction.guild.id);
        const v = guildData.verification || {};
        const member = interaction.member;
        try {
            if (v.verifiedRole) {
                await member.roles.add(v.verifiedRole).catch(() => { });
            }
            if (v.unverifiedRole) {
                await member.roles.remove(v.unverifiedRole).catch(() => { });
            }
            if (v.logsChannel) {
                const logChan = interaction.guild.channels.cache.get(v.logsChannel);
                if (logChan && logChan.isTextBased()) {
                    const verifyColor = getVerifyEmbedColor(guildData);
                    const logContainer = createContainer(verifyColor, `| ${getEmojiTag("action_check")} **Membro Verificado:** <@${member.id}> (\`${member.user.tag}\`)\n| **Horário:** <t:${Math.floor(Date.now() / 1000)}:F>`);
                    await logChan
                        .send({
                        components: [logContainer],
                        flags: ["IsComponentsV2"],
                    })
                        .catch(() => { });
                }
            }
        }
        catch (err) {
            console.error("[Verification] Erro ao atribuir cargos:", err);
        }
        const verifyColor = getVerifyEmbedColor(guildData);
        await interaction.update({
            components: [
                createContainer(verifyColor, `## ${getEmojiTag("action_check")} Verificação Concluída!`, `Parabéns, <@${interaction.user.id}>! Sua identidade foi verificada com sucesso e seu acesso ao servidor já está liberado.`),
            ],
            flags: ["IsComponentsV2"],
        });
    },
});
