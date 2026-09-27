# Expansão da cobertura de logs de auditoria (Prism, Dusk, Sirens)

## Contexto

Os três bots (Prism, Dusk, Sirens) já têm um sistema de logs de servidor:
cada evento relevante do Discord.js tem um arquivo próprio em
`src/discord/events/`, que faz o diff entre o estado antigo e o novo,
busca quem executou a ação via audit log, e manda um card único
("Componentes V2") pro canal configurado em `botLogsChannel`
(`/painel` → Logs). Hoje isso cobre: canais (criar/excluir/parte de
editar), cargos (criar/excluir/parte de editar), emojis (criar/excluir/
renomear), bans (add/remove), membros (entrar/sair/parte de atualizar),
servidor (parte de atualizar) e mensagens (parte de excluir/editar).

O usuário pediu para expandir essa cobertura para bater com a lista de
eventos de um bot de referência (prints de uma tela de configuração,
aparentemente do bot "Xge"), com dois recortes definidos em conversa:

1. **Só os logs de auditoria do Discord** — não o sistema de moderação
   próprio daquele bot (warn/mute/nota/denúncia/casos), que exigiria
   construir um módulo de moderação do zero e foi explicitamente
   excluído do escopo.
2. **Sem toggle individual por evento** — mantém o modelo atual
   (tudo-ou-nada, um canal, todos os eventos habilitados juntos). Não
   entra nenhuma UI de configuração nova.

## Padrão a seguir

Todo evento novo segue exatamente o padrão já estabelecido:

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, <TiposDoDiscordJs> } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "<eventoDoDiscordJs>",
  event: "<eventoDoDiscordJs>",
  async run(...) {
    try {
      // diff dos campos relevantes -> changes: string[]
      if (changes.length === 0) return; // nada relevante mudou, não loga
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.X, targetId);
      const container = createContainer(/* cor por tipo: verde/primary=criação, vermelho=exclusão, amarelo=atualização */);
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[<evento>] Erro ao registrar log:", err);
    }
  },
});
```

Um arquivo pode conter múltiplos `createEvent` quando os eventos são do
mesmo domínio (como já é o caso de `roleEvents.ts`, `emojiEvents.ts`,
`guildBanEvents.ts`).

## Inventário

### Arquivos novos (Prism e Dusk; Sirens recebe a mesma lógica adaptada
às suas convenções — cores/emojis próprios, e ela já não tem
`messageCreate.ts` nem alguns helpers que Prism/Dusk têm)

| Arquivo | Eventos do Discord.js | Cobre da lista |
|---|---|---|
| `threadEvents.ts` | `threadCreate`, `threadDelete`, `threadUpdate` | Thread Create/Delete/Name/Slow Mode/Archive Duration/Archive/Unarchive/Lock/Unlock |
| `voiceStateUpdate.ts` (novo em Prism/Dusk — Sirens já tem, serve de base) | `voiceStateUpdate` | Voice User Join/Leave/Move/Switch |
| `stickerEvents.ts` | `stickerCreate`, `stickerDelete`, `stickerUpdate` | Sticker Create/Delete/Name/Description/Related Emoji |
| `scheduledEventEvents.ts` | `guildScheduledEventCreate`, `...Delete`, `...Update`, `...UserAdd`, `...UserRemove` | Event Create/Delete/Location/Description/Name/Privacy/Start/End/Status/Image/User Subscribe/Unsubscribe |
| `inviteEvents.ts` | `inviteCreate`, `inviteDelete` | Invite Create/Delete |
| `stageEvents.ts` | `stageInstanceCreate`, `...Delete`, `...Update` | Stage Start/End/Topic/Privacy Update |
| `webhookEvents.ts` | `webhookUpdate` (só avisa "mudou algo nesse canal"; usa audit log pra descobrir criação/exclusão/nome/avatar/canal) | Webhook Create/Avatar/Name/Channel Update/Delete |
| `autoModEvents.ts` | `autoModerationRuleCreate`, `...Delete`, `...Update`, `autoModerationActionExecution` | Discord AutoMod Rule Create/Delete/Toggle/Name/Actions/Content/Roles/Channels/Whitelist Update |
| `userUpdate.ts` | `userUpdate` (evento global do client — filtra por servidores onde o usuário é membro antes de logar) | User Name Update (username), User Avatar Update (avatar global) |

### Arquivos existentes que ganham mais campos diffados

| Arquivo | Campos novos |
|---|---|
| `channelUpdate.ts` | NSFW, permissões (resumo de quantas mudaram, não o diff completo), tipo, bitrate, limite de usuários, slowmode, região RTC, qualidade de vídeo, e os campos de fórum (duração padrão de arquivamento, slowmode padrão de thread, emoji de reação padrão, ordem padrão, tags de fórum, layout), status de voz |
| `roleEvents.ts` | Ícone do cargo |
| `guildUpdate.ts` | Descrição, dono, boost level, boost progress bar, canal de updates públicos, canal de regras, splash, discovery splash, canal do sistema, vanity URL, verified, widget, locale preferido, canal/timeout AFK, filtro de conteúdo, features, nível MFA |
| `guildMemberUpdate.ts` | Avatar por servidor, timeout aplicado/removido (`communicationDisabledUntil`) |
| `messageDelete.ts` | Adiciona handler de `messageDeleteBulk` (Message Bulk Delete) |
| `messageUpdate.ts` | Detecta finalização de enquete (`poll.resultsFinalized`) como parte do diff existente, em vez de evento próprio |

### Fora do escopo, com o motivo

- **Applications** (App Add/Remove/Command Permission Update): sem
  evento em tempo real no discord.js pra integrações adicionadas ao
  servidor; baixo valor pra um bot de ticket/loja.
- **Voice Channel Full**: o Discord rejeita a entrada no canal do lado
  do cliente: o bot nunca recebe esse evento.
- **Invite Post**: não existe evento correspondente no discord.js.
- **Poll Finalize** como evento próprio: sem hook dedicado — vira parte
  do diff do `messageUpdate.ts` (ver acima).
- **Message Publish / Message Sent Using Command**: muito ruído, baixo
  valor.
- **Onboarding** (toggle/perguntas): baixíssimo uso nesse tipo de
  servidor.
- **Poll Create/Delete**: não ganham log dedicado — a criação e exclusão
  da mensagem que contém a enquete já passam pelos logs de mensagem
  existentes.

## Sirens: adaptações

A Sirens não compartilha código com Prism/Dusk (repositório e convenções
próprias — cores, emojis, ausência de `messageCreate.ts`/vault). A
lógica e o inventário acima valem igual, mas cada arquivo é escrito nas
convenções dela (emojis próprios, paleta de cores dela), e ela já tem
`voiceStateUpdate.ts`, que só precisa ganhar as sub-detecções que
faltarem (join/leave/move/switch) em vez de ser criado do zero.

## Testes

Sem suíte de testes automatizados no projeto. Verificação por bot:
`npm run check` (typecheck) e `npm run build` antes de cada deploy,
seguindo a disciplina já usada nas sessões anteriores (build limpo antes
de qualquer commit/deploy, já que os bots estão em produção).

## Rollout

Prism e Dusk primeiro (compartilham quase o mesmo código-fonte, dá pra
implementar uma vez e replicar), Sirens depois (adaptando). Cada bot
segue o fluxo já estabelecido: editar `src/`, `npm run check` + `npm run
build`, commit (arquivos `src/` e `build/` juntos), push, `discloud app
commit <id>`, confirmar status "Online" via API antes de seguir pro
próximo.
