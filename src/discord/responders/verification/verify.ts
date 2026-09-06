import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import {
  createContainer,
  createRow,
  Separator,
} from "@magicyan/discord";
import {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { db } from "#database";
import { getEmojiTag } from "#functions";

// Map temporário para armazenar códigos de captcha por usuário
// userId -> { code: string, expires: number }
const userCaptchas = new Map<string, { code: string; expires: number }>();

function generateCaptchaCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem O, 0, I, 1 para evitar ambiguidades
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateDecoyCode(correct: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const posToChange = Math.floor(Math.random() * correct.length);
  const newChar = chars.charAt(Math.floor(Math.random() * chars.length));
  const arr = correct.split("");
  arr[posToChange] = newChar;
  const decoy = arr.join("");
  return decoy === correct ? generateDecoyCode(correct) : decoy;
}

// 1. Informações de segurança
createResponder({
  customId: "verify/captcha/info",
  types: [ResponderType.Button],
  cache: "cached",
  async run(interaction) {
    const container = createContainer(
      "#22c55e",
      `## ${getEmojiTag("shield_check")} Por que a verificação é necessária?`,
      Separator.Default,
      [
        `A verificação por captcha é uma medida de proteção essencial para manter nossa comunidade segura e agradável para todos os membros:`,
        ``,
        `• **Anti-Raid:** Impede que bots de spam e ataques em massa invadam os canais.`,
        `• **Segurança:** Garante que todos os participantes sejam usuários reais.`,
        `• **Proteção de Dados:** Preserva a integridade das conversas e atendimentos.`,
      ].join("\n"),
      Separator.Default,
      `*Basta clicar no botão **Verificar-se** e escolher o código correto para liberar seu acesso imediatamente!*`,
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"] as any,
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

    const decoys = new Set<string>();
    while (decoys.size < 4) {
      const d = generateDecoyCode(code);
      if (d !== code) decoys.add(d);
    }

    const allOptions = [code, ...Array.from(decoys)].sort(
      () => Math.random() - 0.5,
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId("verify/captcha/select")
      .setPlaceholder("Selecione o código correto...")
      .addOptions(
        allOptions.map((opt) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(opt)
            .setValue(opt)
            .setDescription(`Código: ${opt}`),
        ),
      );

    const spacedCode = code.split("").join(" ");

    const container = createContainer(
      "#22c55e",
      `## ${getEmojiTag("shield_check")} Verificação de Segurança (Captcha)`,
      Separator.Default,
      `Para provar que você é humano, identifique o código exibido abaixo e selecione a alternativa correta no menu:`,
      Separator.Default,
      `# \` ${spacedCode} \``,
      Separator.Default,
      createRow(select),
    );

    await interaction.reply({
      components: [container],
      flags: ["Ephemeral", "IsComponentsV2"] as any,
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
          createContainer(
            "#ED4245",
            `## ${getEmojiTag("clock")} Captcha Expirado`,
            "O tempo limite para resolver este captcha expirou. Clique no botão **Verificar-se** novamente para gerar um novo desafio.",
          ),
        ],
        flags: ["IsComponentsV2"] as any,
      });
      return;
    }

    if (selected !== session.code) {
      userCaptchas.delete(interaction.user.id);
      await interaction.update({
        components: [
          createContainer(
            "#ED4245",
            `## ${getEmojiTag("action_x")} Resposta Incorreta`,
            `O código selecionado (\`${selected}\`) não corresponde ao código gerado.\nClique no botão **Verificar-se** novamente para tentar um novo código.`,
          ),
        ],
        flags: ["IsComponentsV2"] as any,
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
        await member.roles.add(v.verifiedRole).catch(() => {});
      }
      if (v.unverifiedRole) {
        await member.roles.remove(v.unverifiedRole).catch(() => {});
      }

      if (v.logsChannel) {
        const logChan = interaction.guild.channels.cache.get(v.logsChannel);
        if (logChan && logChan.isTextBased()) {
          const logContainer = createContainer(
            "#22c55e",
            `| ${getEmojiTag("action_check")} **Membro Verificado:** <@${member.id}> (\`${member.user.tag}\`)\n| **Horário:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          );
          await (logChan as any)
            .send({
              components: [logContainer],
              flags: ["IsComponentsV2"],
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("[Verification] Erro ao atribuir cargos:", err);
    }

    await interaction.update({
      components: [
        createContainer(
          "#22c55e",
          `## ${getEmojiTag("action_check")} Verificação Concluída!`,
          `Parabéns, <@${interaction.user.id}>! Sua identidade foi verificada com sucesso e seu acesso ao servidor já está liberado.`,
        ),
      ],
      flags: ["IsComponentsV2"] as any,
    });
  },
});
