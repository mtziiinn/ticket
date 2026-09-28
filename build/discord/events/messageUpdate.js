import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { getEmojiTag, sendBotLog } from "#functions";
// Guarda simples de mensagens já logadas como enquete finalizada — sem isso,
// qualquer outro messageUpdate na mesma mensagem depois de finalizada (ex.:
// atualização de prévia) logaria de novo, já que não dá pra comparar contra
// um "antes" (ver comentário abaixo).
const loggedPollFinalizations = new Set();
createEvent({
    name: "messageUpdate",
    event: "messageUpdate",
    async run(oldMessage, newMessage) {
        if (!newMessage.guild)
            return;
        if (newMessage.author?.bot)
            return;
        // Enquete finalizada: o texto da mensagem não muda, só o campo
        // poll.resultsFinalized. Não dá pra exigir a mensagem antiga em cache
        // pra comparar o "antes" — o MessageManager guarda só 5 mensagens por
        // canal, e uma enquete quase sempre finaliza depois disso ter saído do
        // cache. Usa só o estado novo + a guarda acima pra não duplicar.
        if (newMessage.poll?.resultsFinalized &&
            !loggedPollFinalizations.has(newMessage.id)) {
            loggedPollFinalizations.add(newMessage.id);
            if (loggedPollFinalizations.size > 200)
                loggedPollFinalizations.clear();
            try {
                const container = createContainer(constants.colors.primary, `## ${getEmojiTag("action_check")} Enquete Finalizada`, [
                    `| Canal: <#${newMessage.channelId}>`,
                    `| \`${newMessage.poll.question.text || "Enquete"}\``,
                    `| [Ir para a mensagem](${newMessage.url})`,
                ].join("\n"));
                await sendBotLog(newMessage.guild, container);
            }
            catch (err) {
                console.error("[messageUpdate] Erro ao registrar log de enquete:", err);
            }
        }
        // Sem a versão antiga no cache não dá para saber se houve edição: só segue
        // se a edição é recente (evita logar atualização de prévia de link).
        if (oldMessage.partial) {
            const editedAt = newMessage.editedTimestamp;
            if (!editedAt || Date.now() - editedAt > 30_000)
                return;
        }
        const oldContent = oldMessage.content?.trim();
        const newContent = newMessage.content?.trim();
        if (oldContent === newContent)
            return;
        if (!oldContent && !newContent)
            return;
        try {
            const author = newMessage.author;
            const beforeText = oldMessage.partial
                ? "*indisponível (mensagem fora do cache)*"
                : oldContent || "*vazio*";
            const afterText = newContent || "*vazio*";
            const container = createContainer("#eab308", `## ${getEmojiTag("action_info")} Mensagem Editada`, [
                `| Canal: <#${newMessage.channelId}>`,
                author ? `| Autor: <@${author.id}>` : "",
                `| [Ir para a mensagem](${newMessage.url})`,
                `**Antes:**\n\`\`\`${beforeText.slice(0, 300)}\`\`\``,
                `**Depois:**\n\`\`\`${afterText.slice(0, 300)}\`\`\``,
            ].filter(Boolean).join("\n"));
            await sendBotLog(newMessage.guild, container);
        }
        catch (err) {
            console.error("[messageUpdate] Erro ao registrar log:", err);
        }
    },
});
