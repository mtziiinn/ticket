import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, AutoModerationActionType, } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";
createEvent({
    name: "autoModerationRuleCreate",
    event: "autoModerationRuleCreate",
    async run(rule) {
        try {
            const executor = await getAuditLogExecutor(rule.guild, AuditLogEvent.AutoModerationRuleCreate, rule.id);
            const container = createContainer(constants.colors.primary, `## ${getEmojiTag("shield_add")} Regra de AutoMod Criada`, [
                `| ${getEmojiTag("shield")} \`${rule.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(rule.guild, container);
        }
        catch (err) {
            console.error("[autoModerationRuleCreate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "autoModerationRuleDelete",
    event: "autoModerationRuleDelete",
    async run(rule) {
        try {
            const executor = await getAuditLogExecutor(rule.guild, AuditLogEvent.AutoModerationRuleDelete, rule.id);
            const container = createContainer("#ef4444", `## ${getEmojiTag("shield_remove")} Regra de AutoMod Excluída`, [
                `| ${getEmojiTag("shield")} \`${rule.name}\``,
                executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(rule.guild, container);
        }
        catch (err) {
            console.error("[autoModerationRuleDelete] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "autoModerationRuleUpdate",
    event: "autoModerationRuleUpdate",
    async run(oldRule, newRule) {
        if (!oldRule)
            return;
        try {
            const changes = [];
            if (oldRule.name !== newRule.name) {
                changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldRule.name}\` ➔ \`${newRule.name}\``);
            }
            if (oldRule.enabled !== newRule.enabled) {
                changes.push(`• ${getEmojiTag("action_info")} ${newRule.enabled ? "Ativada" : "Desativada"}`);
            }
            if (JSON.stringify(oldRule.actions) !== JSON.stringify(newRule.actions)) {
                changes.push(`• ${getEmojiTag("shield")} Ações modificadas`);
            }
            if (JSON.stringify(oldRule.triggerMetadata.keywordFilter) !== JSON.stringify(newRule.triggerMetadata.keywordFilter) ||
                JSON.stringify(oldRule.triggerMetadata.regexPatterns) !== JSON.stringify(newRule.triggerMetadata.regexPatterns) ||
                JSON.stringify(oldRule.triggerMetadata.allowList) !== JSON.stringify(newRule.triggerMetadata.allowList)) {
                changes.push(`• ${getEmojiTag("clipboard")} Palavras/padrões filtrados alterados`);
            }
            if (oldRule.exemptRoles.size !== newRule.exemptRoles.size ||
                !oldRule.exemptRoles.every((r) => newRule.exemptRoles.has(r.id))) {
                changes.push(`• ${getEmojiTag("user_users")} Cargos isentos alterados`);
            }
            if (oldRule.exemptChannels.size !== newRule.exemptChannels.size ||
                !oldRule.exemptChannels.every((c) => newRule.exemptChannels.has(c.id))) {
                changes.push(`• ${getEmojiTag("folder")} Canais isentos alterados`);
            }
            if (changes.length === 0)
                return;
            const executor = await getAuditLogExecutor(newRule.guild, AuditLogEvent.AutoModerationRuleUpdate, newRule.id);
            const container = createContainer("#eab308", `## ${getEmojiTag("shield_check")} Regra de AutoMod Atualizada`, [
                `| ${getEmojiTag("shield")} \`${newRule.name}\``,
                executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
                changes.join("\n"),
            ].filter(Boolean).join("\n"));
            await sendBotLog(newRule.guild, container);
        }
        catch (err) {
            console.error("[autoModerationRuleUpdate] Erro ao registrar log:", err);
        }
    },
});
createEvent({
    name: "autoModerationActionExecution",
    event: "autoModerationActionExecution",
    async run(execution) {
        // Uma regra pode ter várias ações (bloquear + alertar + timeout), e o
        // discord.js dispara esse evento uma vez POR AÇÃO — sem esse filtro,
        // um único bloqueio virava até 3 logs, todos dizendo "Bloqueou uma
        // Mensagem" mesmo quando a ação era só um alerta ou um timeout.
        if (execution.action.type !== AutoModerationActionType.BlockMessage)
            return;
        try {
            const container = createContainer("#eab308", `## ${getEmojiTag("shield_x")} AutoMod Bloqueou uma Mensagem`, [
                `| ${getEmojiTag("user")} <@${execution.userId}>`,
                execution.channelId ? `| ${getEmojiTag("folder")} <#${execution.channelId}>` : "",
                execution.matchedKeyword ? `| ${getEmojiTag("action_warning")} Palavra: \`${execution.matchedKeyword}\`` : "",
            ].filter(Boolean).join("\n"));
            await sendBotLog(execution.guild, container);
        }
        catch (err) {
            console.error("[autoModerationActionExecution] Erro ao registrar log:", err);
        }
    },
});
