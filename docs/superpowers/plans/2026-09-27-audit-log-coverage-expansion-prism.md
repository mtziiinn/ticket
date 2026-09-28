# Expansão de Logs de Auditoria — Prism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir o sistema de logs de auditoria do bot Prism para cobrir threads, voz, stickers, eventos agendados, convites, stage, webhooks, automod, mudanças de usuário globais, e mais campos nos logs de canal/cargo/servidor/mensagem que já existem.

**Architecture:** Um arquivo por domínio de evento em `src/discord/events/`, seguindo o padrão já estabelecido no projeto: cada `createEvent` faz o diff entre o estado antigo e novo, busca o executor via `getAuditLogExecutor(guild, AuditLogEvent.X, targetId?)`, e manda um card (Components V2) via `sendBotLog(guild, container)` pro canal configurado em `botLogsChannel`. Nenhuma tabela nova no banco, nenhuma UI nova — reaproveita a config de logs que já existe.

**Tech Stack:** discord.js 14.26 (`@constatic/base` pro `createEvent`), `@magicyan/discord` (`createContainer`, `createSection`, `Separator`), TypeScript, build via `tsc`.

**Spec:** `docs/superpowers/specs/2026-09-27-audit-log-coverage-expansion-design.md`

## Global Constraints

- Escopo: só logs de auditoria do Discord — sem sistema de moderação (warn/mute/nota/caso) e sem toggle individual por evento (acordado com o usuário).
- Sem suíte de testes automatizada no projeto. "Teste" de cada task é `npm run check` (typecheck) seguido de `npm run build` — os dois têm que passar sem erro antes de cada commit.
- `getEmojiTag(name)` só aceita nomes que já existem em `emojis.json` (é `keyof typeof emojis.static` — nome inválido quebra o build). A lista completa de nomes válidos usados neste plano: `action_add`, `action_check`, `action_info`, `action_remove`, `action_warning`, `action_x`, `arrow_right`, `bell`, `bell_add`, `bell_remove`, `calendar`, `calendar_add`, `calendar_check`, `calendar_remove`, `calendar_x`, `clipboard`, `clipboard_add`, `clipboard_remove`, `clock`, `file`, `file_add`, `file_remove`, `folder`, `folder_open`, `lock`, `mail_add`, `mail_remove`, `shield`, `shield_add`, `shield_check`, `shield_remove`, `shield_x`, `unlock`, `user`, `user_check`, `user_remove`, `user_users`.
- Cores por tipo (já convencionado no projeto): `constants.colors.primary` ou `"#22c55e"` para criação/positivo, `"#ef4444"` para exclusão, `"#eab308"` para atualização.
- Todo handler novo fica dentro de `try { ... } catch (err) { console.error("[<evento>] Erro ao registrar log:", err); }` — um erro num log nunca pode derrubar o processo nem impedir o evento de continuar sendo processado por outros listeners.
- `sendBotLog` já retorna silenciosamente se o servidor não tiver `botLogsChannel` configurado — nenhuma task precisa checar isso de novo.
- Arquivos compilados (`build/`) são comitados junto com o `src/` correspondente — é como o projeto já funciona (sem CI de build).
- Depois do build limpo de todas as tasks, `discloud app commit 1788907433488` faz o deploy; confirmar `container: "Online"` via `GET https://api.discloud.app/v2/app/1788907433488/status` antes de considerar a task de deploy concluída.

## Review Focus

- **Nome de emoji inexistente:** qualquer `getEmojiTag("algumNomeErrado")` quebra `npm run check` na hora — cada task roda o typecheck antes de seguir pra próxima.
- **`userUpdate` global:** o evento dispara pra qualquer usuário em cache, não só membros de um servidor — sem o filtro por `guild.members.cache.has(id)`, o bot logaria mudanças de gente de fora do servidor, ou duplicaria o log em cada guild que o bot está.
- **Acesso a campo que não existe no tipo do canal:** `channelUpdate.ts` usa `(x as any).campo` porque o tipo é uma união de vários tipos de canal — sem guardar com `"campo" in x` ou `typeof x.campo === "..."`, campos ausentes (`undefined`) em ambos os lados passariam a igualdade e não gerariam falso positivo, mas campos ausentes só de um lado (ex.: canal virou outro tipo) podem gerar uma linha de diff sem sentido — cada campo novo tem guarda própria.
- **Falta de permissão para ler audit log:** se o bot não tiver `View Audit Log`, `getAuditLogExecutor` já retorna `null` (tratado dentro da própria função) — os handlers novos têm que continuar funcionando (executor "Não identificado" ou linha omitida) em vez de quebrar.
- **Webhook: falso positivo entre create/update/delete:** como `webhookUpdate` não diz o que mudou, o handler busca os 3 tipos de audit log e pega o mais recente dentro de uma janela de 10s — se nada for encontrado nesse prazo (ex.: bot sem permissão de audit log), a task tem que sair sem mandar log nenhum, não mandar um log incorreto.

---

### Task 1: Log de Threads

**Files:**
- Create: `src/discord/events/threadEvents.ts`

**Interfaces:**
- Consumes: `createEvent` (`#base`), `createContainer` (`@magicyan/discord`), `AuditLogEvent`, `AnyThreadChannel` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog` (`#functions`)
- Produces: nada consumido por outras tasks (arquivo independente)

- [ ] **Step 1: Criar o arquivo com os três handlers (create, delete, update)**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AnyThreadChannel, AuditLogEvent } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "threadCreate",
  event: "threadCreate",
  async run(thread: AnyThreadChannel, newlyCreated: boolean) {
    // Threads recuperadas do cache ao iniciar o bot não contam como "criadas agora".
    if (!newlyCreated) return;

    try {
      const executor = await getAuditLogExecutor(
        thread.guild,
        AuditLogEvent.ThreadCreate,
        thread.id,
      );

      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("clipboard_add")} Thread Criada`,
        [
          `| ${getEmojiTag("folder")} <#${thread.id}> (\`${thread.name}\`)`,
          `| ${getEmojiTag("folder_open")} Canal pai: ${thread.parentId ? `<#${thread.parentId}>` : "Nenhum"}`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(thread.guild, container);
    } catch (err) {
      console.error("[threadCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "threadDelete",
  event: "threadDelete",
  async run(thread: AnyThreadChannel) {
    try {
      const executor = await getAuditLogExecutor(
        thread.guild,
        AuditLogEvent.ThreadDelete,
        thread.id,
      );

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("clipboard_remove")} Thread Excluída`,
        [
          `| ${getEmojiTag("folder")} \`${thread.name}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(thread.guild, container);
    } catch (err) {
      console.error("[threadDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "threadUpdate",
  event: "threadUpdate",
  async run(oldThread: AnyThreadChannel, newThread: AnyThreadChannel) {
    try {
      const changes: string[] = [];

      if (oldThread.name !== newThread.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldThread.name}\` ➔ \`${newThread.name}\``);
      }

      if (oldThread.archived !== newThread.archived) {
        changes.push(`• ${getEmojiTag("action_info")} ${newThread.archived ? "Arquivada" : "Desarquivada"}`);
      }

      if (oldThread.locked !== newThread.locked) {
        changes.push(`• ${getEmojiTag("lock")} ${newThread.locked ? "Trancada" : "Destrancada"}`);
      }

      if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
        changes.push(`• ${getEmojiTag("clock")} Slowmode: \`${oldThread.rateLimitPerUser ?? 0}s\` ➔ \`${newThread.rateLimitPerUser ?? 0}s\``);
      }

      if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
        changes.push(`• ${getEmojiTag("clock")} Arquivamento automático: \`${oldThread.autoArchiveDuration ?? 0}min\` ➔ \`${newThread.autoArchiveDuration ?? 0}min\``);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newThread.guild,
        AuditLogEvent.ThreadUpdate,
        newThread.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Thread Atualizada`,
        [
          `| ${getEmojiTag("folder")} <#${newThread.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newThread.guild, container);
    } catch (err) {
      console.error("[threadUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/threadEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/threadEvents.ts build/discord/events/threadEvents.js
git commit -m "feat(logs): log de threads (criar/excluir/atualizar)"
```

---

### Task 2: Log de Voz

**Files:**
- Create: `src/discord/events/voiceStateUpdate.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `Separator` (`@magicyan/discord`), `VoiceState` (`discord.js`), `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

**Nota:** a Sirens já tem esse mesmo arquivo funcionando — este código é o dela adaptado pra usar o emoji `arrow_right` do Prism (`getEmojiTag`) em vez do ID cru que a Sirens usa.

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer, Separator } from "@magicyan/discord";
import { VoiceState } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "voiceStateUpdate",
  event: "voiceStateUpdate",
  async run(oldState: VoiceState, newState: VoiceState) {
    if (oldState.channelId === newState.channelId) return;

    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member) return;

    try {
      const ts = Math.floor(Date.now() / 1000);
      let title = "";
      let details = "";

      if (!oldState.channelId && newState.channelId) {
        title = `## ${getEmojiTag("action_check")} Entrou na Voz`;
        details = `| ${getEmojiTag("folder")} <#${newState.channelId}>`;
      } else if (oldState.channelId && !newState.channelId) {
        title = `## ${getEmojiTag("action_x")} Saiu da Voz`;
        details = `| ${getEmojiTag("folder")} <#${oldState.channelId}>`;
      } else {
        title = `## ${getEmojiTag("action_info")} Trocou de Canal`;
        details = `| ${getEmojiTag("folder")} <#${oldState.channelId}> ${getEmojiTag("arrow_right")} <#${newState.channelId}>`;
      }

      const container = createContainer(
        !oldState.channelId ? "#22c55e" : oldState.channelId && !newState.channelId ? "#ef4444" : "#eab308",
        title,
        Separator.Default,
        [
          `| ${getEmojiTag("user")} <@${member.id}>`,
          details,
          `| ${getEmojiTag("clock")} <t:${ts}:f> (<t:${ts}:R>)`,
        ].join("\n"),
      );

      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[voiceStateUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/voiceStateUpdate.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/voiceStateUpdate.ts build/discord/events/voiceStateUpdate.js
git commit -m "feat(logs): log de entrada/saida/troca de canal de voz"
```

---

### Task 3: Log de Figurinhas (Stickers)

**Files:**
- Create: `src/discord/events/stickerEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `Sticker` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, Sticker } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "stickerCreate",
  event: "stickerCreate",
  async run(sticker: Sticker) {
    if (!sticker.guild) return;
    try {
      const executor = await getAuditLogExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("file_add")} Figurinha Criada`,
        [
          `| ${getEmojiTag("file")} \`${sticker.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(sticker.guild, container);
    } catch (err) {
      console.error("[stickerCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stickerDelete",
  event: "stickerDelete",
  async run(sticker: Sticker) {
    if (!sticker.guild) return;
    try {
      const executor = await getAuditLogExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("file_remove")} Figurinha Excluída`,
        [
          `| ${getEmojiTag("file")} \`${sticker.name}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(sticker.guild, container);
    } catch (err) {
      console.error("[stickerDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stickerUpdate",
  event: "stickerUpdate",
  async run(oldSticker: Sticker, newSticker: Sticker) {
    if (!newSticker.guild) return;
    try {
      const changes: string[] = [];

      if (oldSticker.name !== newSticker.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldSticker.name}\` ➔ \`${newSticker.name}\``);
      }
      if (oldSticker.description !== newSticker.description) {
        changes.push(`• ${getEmojiTag("clipboard")} Descrição alterada`);
      }
      if (oldSticker.tags !== newSticker.tags) {
        changes.push(`• ${getEmojiTag("action_info")} Emoji relacionado: \`${oldSticker.tags || "nenhum"}\` ➔ \`${newSticker.tags || "nenhum"}\``);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id);
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Figurinha Atualizada`,
        [
          `| ${getEmojiTag("file")} \`${newSticker.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(newSticker.guild, container);
    } catch (err) {
      console.error("[stickerUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/stickerEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/stickerEvents.ts build/discord/events/stickerEvents.js
git commit -m "feat(logs): log de figurinhas (criar/excluir/atualizar)"
```

---

### Task 4: Log de Eventos Agendados

**Files:**
- Create: `src/discord/events/scheduledEventEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `GuildScheduledEvent`, `PartialGuildScheduledEvent`, `User` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  GuildScheduledEvent,
  PartialGuildScheduledEvent,
  User,
} from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildScheduledEventCreate",
  event: "guildScheduledEventCreate",
  async run(event: GuildScheduledEvent) {
    const guild = event.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventCreate, event.id);
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("calendar_add")} Evento Criado`,
        [
          `| ${getEmojiTag("calendar")} \`${event.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[guildScheduledEventCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "guildScheduledEventDelete",
  event: "guildScheduledEventDelete",
  async run(event: GuildScheduledEvent | PartialGuildScheduledEvent) {
    const guild = event.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventDelete, event.id);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("calendar_remove")} Evento Excluído`,
        [
          `| ${getEmojiTag("calendar")} \`${event.name}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[guildScheduledEventDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "guildScheduledEventUpdate",
  event: "guildScheduledEventUpdate",
  async run(
    oldEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null,
    newEvent: GuildScheduledEvent,
  ) {
    const guild = newEvent.guild;
    if (!guild || !oldEvent) return;
    try {
      const changes: string[] = [];

      if (oldEvent.name !== newEvent.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldEvent.name}\` ➔ \`${newEvent.name}\``);
      }
      if (oldEvent.description !== newEvent.description) {
        changes.push(`• ${getEmojiTag("clipboard")} Descrição alterada`);
      }
      if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) {
        changes.push(`• ${getEmojiTag("clock")} Início reagendado`);
      }
      if (oldEvent.scheduledEndTimestamp !== newEvent.scheduledEndTimestamp) {
        changes.push(`• ${getEmojiTag("clock")} Término reagendado`);
      }
      if (oldEvent.privacyLevel !== newEvent.privacyLevel) {
        changes.push(`• ${getEmojiTag("shield")} Privacidade alterada`);
      }
      if (oldEvent.status !== newEvent.status) {
        changes.push(`• ${getEmojiTag("action_info")} Status: \`${oldEvent.status}\` ➔ \`${newEvent.status}\``);
      }
      if (oldEvent.image !== newEvent.image) {
        changes.push(`• ${getEmojiTag("file")} Imagem de capa atualizada`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(guild, AuditLogEvent.GuildScheduledEventUpdate, newEvent.id);
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("calendar_check")} Evento Atualizado`,
        [
          `| ${getEmojiTag("calendar")} \`${newEvent.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[guildScheduledEventUpdate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "guildScheduledEventUserAdd",
  event: "guildScheduledEventUserAdd",
  async run(event: GuildScheduledEvent | PartialGuildScheduledEvent, user: User) {
    const guild = event.guild;
    if (!guild) return;
    try {
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("calendar_check")} Interesse em Evento`,
        [
          `| ${getEmojiTag("calendar")} \`${event.name}\``,
          `| ${getEmojiTag("user")} <@${user.id}> confirmou interesse`,
        ].join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[guildScheduledEventUserAdd] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "guildScheduledEventUserRemove",
  event: "guildScheduledEventUserRemove",
  async run(event: GuildScheduledEvent | PartialGuildScheduledEvent, user: User) {
    const guild = event.guild;
    if (!guild) return;
    try {
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("calendar_x")} Interesse Removido de Evento`,
        [
          `| ${getEmojiTag("calendar")} \`${event.name}\``,
          `| ${getEmojiTag("user")} <@${user.id}> desmarcou interesse`,
        ].join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[guildScheduledEventUserRemove] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/scheduledEventEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/scheduledEventEvents.ts build/discord/events/scheduledEventEvents.js
git commit -m "feat(logs): log de eventos agendados"
```

---

### Task 5: Log de Convites

**Files:**
- Create: `src/discord/events/inviteEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `Invite` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

**Nota:** `Invite.guild` pode ser `InviteGuild | Guild | null` (tipo mais restrito que `Guild`), então o handler pega o `guild` a partir de `invite.channel.guild` em vez de `invite.guild`, pra manter o tipo certo pro `sendBotLog`.

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, Invite } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "inviteCreate",
  event: "inviteCreate",
  async run(invite: Invite) {
    if (!invite.channel || !("guild" in invite.channel)) return;
    const guild = invite.channel.guild;

    try {
      const inviter = invite.inviter;
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("mail_add")} Convite Criado`,
        [
          `| ${getEmojiTag("folder")} <#${invite.channelId}>`,
          `| \`${invite.code}\``,
          inviter ? `| ${getEmojiTag("user_check")} <@${inviter.id}>` : "",
          `| ${getEmojiTag("clock")} Expira: ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : "nunca"}`,
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[inviteCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "inviteDelete",
  event: "inviteDelete",
  async run(invite: Invite) {
    if (!invite.channel || !("guild" in invite.channel)) return;
    const guild = invite.channel.guild;

    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.InviteDelete, invite.code);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("mail_remove")} Convite Excluído`,
        [
          `| \`${invite.code}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[inviteDelete] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/inviteEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/inviteEvents.ts build/discord/events/inviteEvents.js
git commit -m "feat(logs): log de convites criados/excluidos"
```

---

### Task 6: Log de Palco (Stage)

**Files:**
- Create: `src/discord/events/stageEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `StageInstance` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, StageInstance } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "stageInstanceCreate",
  event: "stageInstanceCreate",
  async run(stageInstance: StageInstance) {
    const guild = stageInstance.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceCreate, stageInstance.id);
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("bell_add")} Palco Iniciado`,
        [
          `| ${getEmojiTag("folder")} <#${stageInstance.channelId}>`,
          `| ${getEmojiTag("clipboard")} \`${stageInstance.topic}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stageInstanceDelete",
  event: "stageInstanceDelete",
  async run(stageInstance: StageInstance) {
    const guild = stageInstance.guild;
    if (!guild) return;
    try {
      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceDelete, stageInstance.id);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("bell_remove")} Palco Encerrado`,
        [
          `| ${getEmojiTag("folder")} <#${stageInstance.channelId}>`,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "stageInstanceUpdate",
  event: "stageInstanceUpdate",
  async run(oldStageInstance: StageInstance | null, newStageInstance: StageInstance) {
    const guild = newStageInstance.guild;
    if (!guild || !oldStageInstance) return;
    try {
      const changes: string[] = [];

      if (oldStageInstance.topic !== newStageInstance.topic) {
        changes.push(`• ${getEmojiTag("clipboard")} Tópico: \`${oldStageInstance.topic}\` ➔ \`${newStageInstance.topic}\``);
      }
      if (oldStageInstance.privacyLevel !== newStageInstance.privacyLevel) {
        changes.push(`• ${getEmojiTag("shield")} Privacidade alterada`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(guild, AuditLogEvent.StageInstanceUpdate, newStageInstance.id);
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("bell")} Palco Atualizado`,
        [
          `| ${getEmojiTag("folder")} <#${newStageInstance.channelId}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[stageInstanceUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/stageEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/stageEvents.ts build/discord/events/stageEvents.js
git commit -m "feat(logs): log de palco (stage) iniciar/encerrar/atualizar"
```

---

### Task 7: Log de Webhooks

**Files:**
- Create: `src/discord/events/webhookEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `GuildTextBasedChannel` (`discord.js`), `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

**Nota:** `webhookUpdate` só avisa "algo mudou nos webhooks desse canal", sem dizer o quê — o handler busca os 3 tipos de audit log de webhook (create/update/delete) e usa o mais recente dentro de 10s pra decidir o que aconteceu.

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, GuildTextBasedChannel } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

const WEBHOOK_LOG_TYPES = [
  { type: AuditLogEvent.WebhookCreate, label: "Criado", emoji: "action_add" as const, color: "#22c55e" },
  { type: AuditLogEvent.WebhookDelete, label: "Excluído", emoji: "action_remove" as const, color: "#ef4444" },
  { type: AuditLogEvent.WebhookUpdate, label: "Atualizado", emoji: "action_info" as const, color: "#eab308" },
];

createEvent({
  name: "webhookUpdate",
  event: "webhookUpdate",
  async run(channel: GuildTextBasedChannel) {
    const guild = channel.guild;
    if (!guild) return;

    try {
      const now = Date.now();
      let best: { entry: any; label: string; emoji: "action_add" | "action_remove" | "action_info"; color: string } | null = null;

      for (const t of WEBHOOK_LOG_TYPES) {
        const logs = await guild.fetchAuditLogs({ type: t.type, limit: 1 }).catch(() => null);
        const entry = logs?.entries.first();
        if (!entry) continue;
        if (now - entry.createdTimestamp > 10_000) continue;
        if (!best || entry.createdTimestamp > best.entry.createdTimestamp) {
          best = { entry, label: t.label, emoji: t.emoji, color: t.color };
        }
      }

      if (!best) return;

      const targetName = (best.entry.target as any)?.name || "Webhook";
      const executor = best.entry.executor;

      const container = createContainer(
        best.color,
        `## ${getEmojiTag(best.emoji)} Webhook ${best.label}`,
        [
          `| ${getEmojiTag("folder")} <#${channel.id}>`,
          `| \`${targetName}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(guild, container);
    } catch (err) {
      console.error("[webhookUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/webhookEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/webhookEvents.ts build/discord/events/webhookEvents.js
git commit -m "feat(logs): log de webhooks criados/editados/excluidos"
```

---

### Task 8: Log de AutoMod

**Files:**
- Create: `src/discord/events/autoModEvents.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `AuditLogEvent`, `AutoModerationActionExecution`, `AutoModerationRule` (`discord.js`), `getAuditLogExecutor`, `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import {
  AuditLogEvent,
  AutoModerationActionExecution,
  AutoModerationRule,
} from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "autoModerationRuleCreate",
  event: "autoModerationRuleCreate",
  async run(rule: AutoModerationRule) {
    try {
      const executor = await getAuditLogExecutor(rule.guild, AuditLogEvent.AutoModerationRuleCreate, rule.id);
      const container = createContainer(
        constants.colors.primary,
        `## ${getEmojiTag("shield_add")} Regra de AutoMod Criada`,
        [
          `| ${getEmojiTag("shield")} \`${rule.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(rule.guild, container);
    } catch (err) {
      console.error("[autoModerationRuleCreate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "autoModerationRuleDelete",
  event: "autoModerationRuleDelete",
  async run(rule: AutoModerationRule) {
    try {
      const executor = await getAuditLogExecutor(rule.guild, AuditLogEvent.AutoModerationRuleDelete, rule.id);
      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("shield_remove")} Regra de AutoMod Excluída`,
        [
          `| ${getEmojiTag("shield")} \`${rule.name}\``,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(rule.guild, container);
    } catch (err) {
      console.error("[autoModerationRuleDelete] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "autoModerationRuleUpdate",
  event: "autoModerationRuleUpdate",
  async run(oldRule: AutoModerationRule | null, newRule: AutoModerationRule) {
    if (!oldRule) return;
    try {
      const changes: string[] = [];

      if (oldRule.name !== newRule.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldRule.name}\` ➔ \`${newRule.name}\``);
      }
      if (oldRule.enabled !== newRule.enabled) {
        changes.push(`• ${getEmojiTag("action_info")} ${newRule.enabled ? "Ativada" : "Desativada"}`);
      }
      if (JSON.stringify(oldRule.actions) !== JSON.stringify(newRule.actions)) {
        changes.push(`• ${getEmojiTag("shield")} Ações modificadas`);
      }
      if (
        JSON.stringify(oldRule.triggerMetadata.keywordFilter) !== JSON.stringify(newRule.triggerMetadata.keywordFilter) ||
        JSON.stringify(oldRule.triggerMetadata.regexPatterns) !== JSON.stringify(newRule.triggerMetadata.regexPatterns) ||
        JSON.stringify(oldRule.triggerMetadata.allowList) !== JSON.stringify(newRule.triggerMetadata.allowList)
      ) {
        changes.push(`• ${getEmojiTag("clipboard")} Palavras/padrões filtrados alterados`);
      }
      if (
        oldRule.exemptRoles.size !== newRule.exemptRoles.size ||
        !oldRule.exemptRoles.every((r) => newRule.exemptRoles.has(r.id))
      ) {
        changes.push(`• ${getEmojiTag("user_users")} Cargos isentos alterados`);
      }
      if (
        oldRule.exemptChannels.size !== newRule.exemptChannels.size ||
        !oldRule.exemptChannels.every((c) => newRule.exemptChannels.has(c.id))
      ) {
        changes.push(`• ${getEmojiTag("folder")} Canais isentos alterados`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(newRule.guild, AuditLogEvent.AutoModerationRuleUpdate, newRule.id);
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("shield_check")} Regra de AutoMod Atualizada`,
        [
          `| ${getEmojiTag("shield")} \`${newRule.name}\``,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(newRule.guild, container);
    } catch (err) {
      console.error("[autoModerationRuleUpdate] Erro ao registrar log:", err);
    }
  },
});

createEvent({
  name: "autoModerationActionExecution",
  event: "autoModerationActionExecution",
  async run(execution: AutoModerationActionExecution) {
    try {
      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("shield_x")} AutoMod Bloqueou uma Mensagem`,
        [
          `| ${getEmojiTag("user")} <@${execution.userId}>`,
          execution.channelId ? `| ${getEmojiTag("folder")} <#${execution.channelId}>` : "",
          execution.matchedKeyword ? `| ${getEmojiTag("action_warning")} Palavra: \`${execution.matchedKeyword}\`` : "",
        ].filter(Boolean).join("\n"),
      );
      await sendBotLog(execution.guild, container);
    } catch (err) {
      console.error("[autoModerationActionExecution] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/autoModEvents.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/autoModEvents.ts build/discord/events/autoModEvents.js
git commit -m "feat(logs): log de regras de automod e bloqueios"
```

---

### Task 9: Log de Usuário (nome/avatar globais)

**Files:**
- Create: `src/discord/events/userUpdate.ts`

**Interfaces:**
- Consumes: `createEvent`, `createContainer`, `PartialUser`, `User` (`discord.js`), `getEmojiTag`, `sendBotLog`
- Produces: nada consumido por outras tasks

**Nota:** `userUpdate` é global (não amarrado a um servidor) — o handler só loga nos servidores onde esse usuário está em cache como membro, senão logaria mudança de gente de fora do servidor ou duplicaria em cada guild.

- [ ] **Step 1: Criar o arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { PartialUser, User } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "userUpdate",
  event: "userUpdate",
  async run(oldUser: User | PartialUser, newUser: User) {
    if (newUser.bot) return;
    if (oldUser.partial) return; // sem estado antigo confiável, não dá pra comparar

    const changes: string[] = [];
    if (oldUser.username !== newUser.username) {
      changes.push(`• ${getEmojiTag("action_info")} Nome de usuário: \`${oldUser.username}\` ➔ \`${newUser.username}\``);
    }
    if (oldUser.avatar !== newUser.avatar) {
      changes.push(`• ${getEmojiTag("user")} Avatar global atualizado`);
    }
    if (changes.length === 0) return;

    try {
      for (const guild of newUser.client.guilds.cache.values()) {
        if (!guild.members.cache.has(newUser.id)) continue;

        const container = createContainer(
          "#eab308",
          `## ${getEmojiTag("action_info")} Usuário Atualizado`,
          [
            `| ${getEmojiTag("user")} <@${newUser.id}> (\`${newUser.id}\`)`,
            changes.join("\n"),
          ].join("\n"),
        );

        await sendBotLog(guild, container);
      }
    } catch (err) {
      console.error("[userUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros, `build/discord/events/userUpdate.js` criado

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/userUpdate.ts build/discord/events/userUpdate.js
git commit -m "feat(logs): log de mudanca de nome/avatar global de usuario"
```

---

### Task 10: Extensão do Log de Canal

**Files:**
- Modify: `src/discord/events/channelUpdate.ts` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: mesmas do arquivo atual, sem novas dependências externas
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { AuditLogEvent, DMChannel, NonThreadGuildBasedChannel } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

const VIDEO_QUALITY_LABELS: Record<number, string> = { 1: "Automático", 2: "720p" };

function diffPermissionOverwrites(oldChannel: any, newChannel: any): number {
  const oldMap = oldChannel.permissionOverwrites?.cache as Map<string, any> | undefined;
  const newMap = newChannel.permissionOverwrites?.cache as Map<string, any> | undefined;
  if (!oldMap || !newMap) return 0;

  let diffCount = 0;
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  for (const id of ids) {
    const before = oldMap.get(id);
    const after = newMap.get(id);
    if (!before || !after) {
      diffCount++;
      continue;
    }
    if (before.allow.bitfield !== after.allow.bitfield || before.deny.bitfield !== after.deny.bitfield) {
      diffCount++;
    }
  }
  return diffCount;
}

createEvent({
  name: "channelUpdate",
  event: "channelUpdate",
  async run(
    oldChannel: DMChannel | NonThreadGuildBasedChannel,
    newChannel: DMChannel | NonThreadGuildBasedChannel,
  ) {
    if (oldChannel.isDMBased() || newChannel.isDMBased() || !newChannel.guild) return;

    try {
      const changes: string[] = [];
      const oldAny = oldChannel as any;
      const newAny = newChannel as any;

      if (oldChannel.name !== newChannel.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
      }

      if (oldChannel.parentId !== newChannel.parentId) {
        const oldParent = oldChannel.parent?.name || "Nenhuma";
        const newParent = newChannel.parent?.name || "Nenhuma";
        changes.push(`• ${getEmojiTag("folder_open")} Categoria: \`${oldParent}\` ➔ \`${newParent}\``);
      }

      const oldTopic = oldAny.topic || "";
      const newTopic = newAny.topic || "";
      if (oldTopic !== newTopic) {
        changes.push(`• ${getEmojiTag("clipboard")} Tópico alterado`);
      }

      if (oldChannel.type !== newChannel.type) {
        changes.push(`• ${getEmojiTag("action_info")} Tipo de canal alterado`);
      }

      if (typeof oldAny.nsfw === "boolean" && oldAny.nsfw !== newAny.nsfw) {
        changes.push(`• ${getEmojiTag("action_warning")} NSFW: \`${oldAny.nsfw ? "Sim" : "Não"}\` ➔ \`${newAny.nsfw ? "Sim" : "Não"}\``);
      }

      if (typeof oldAny.bitrate === "number" && oldAny.bitrate !== newAny.bitrate) {
        changes.push(`• ${getEmojiTag("action_info")} Bitrate: \`${oldAny.bitrate}\` ➔ \`${newAny.bitrate}\``);
      }

      if (typeof oldAny.userLimit === "number" && oldAny.userLimit !== newAny.userLimit) {
        changes.push(`• ${getEmojiTag("user_users")} Limite de usuários: \`${oldAny.userLimit || "sem limite"}\` ➔ \`${newAny.userLimit || "sem limite"}\``);
      }

      if (typeof oldAny.rateLimitPerUser === "number" && oldAny.rateLimitPerUser !== newAny.rateLimitPerUser) {
        changes.push(`• ${getEmojiTag("clock")} Slowmode: \`${oldAny.rateLimitPerUser}s\` ➔ \`${newAny.rateLimitPerUser}s\``);
      }

      if ("rtcRegion" in oldAny && oldAny.rtcRegion !== newAny.rtcRegion) {
        changes.push(`• ${getEmojiTag("action_info")} Região de voz: \`${oldAny.rtcRegion || "Automático"}\` ➔ \`${newAny.rtcRegion || "Automático"}\``);
      }

      if ("videoQualityMode" in oldAny && oldAny.videoQualityMode !== newAny.videoQualityMode) {
        changes.push(`• ${getEmojiTag("action_info")} Qualidade de vídeo: \`${VIDEO_QUALITY_LABELS[oldAny.videoQualityMode] || "Automático"}\` ➔ \`${VIDEO_QUALITY_LABELS[newAny.videoQualityMode] || "Automático"}\``);
      }

      if ("defaultAutoArchiveDuration" in oldAny && oldAny.defaultAutoArchiveDuration !== newAny.defaultAutoArchiveDuration) {
        changes.push(`• ${getEmojiTag("clock")} Arquivamento padrão de threads: \`${oldAny.defaultAutoArchiveDuration}min\` ➔ \`${newAny.defaultAutoArchiveDuration}min\``);
      }

      if ("defaultThreadRateLimitPerUser" in oldAny && oldAny.defaultThreadRateLimitPerUser !== newAny.defaultThreadRateLimitPerUser) {
        changes.push(`• ${getEmojiTag("clock")} Slowmode padrão de threads: \`${oldAny.defaultThreadRateLimitPerUser ?? 0}s\` ➔ \`${newAny.defaultThreadRateLimitPerUser ?? 0}s\``);
      }

      if ("defaultReactionEmoji" in oldAny) {
        const oldEmoji = oldAny.defaultReactionEmoji?.name || null;
        const newEmoji = newAny.defaultReactionEmoji?.name || null;
        if (oldEmoji !== newEmoji) {
          changes.push(`• ${getEmojiTag("action_info")} Emoji de reação padrão: \`${oldEmoji || "nenhum"}\` ➔ \`${newEmoji || "nenhum"}\``);
        }
      }

      if ("defaultSortOrder" in oldAny && oldAny.defaultSortOrder !== newAny.defaultSortOrder) {
        changes.push(`• ${getEmojiTag("action_info")} Ordenação padrão do fórum alterada`);
      }

      if ("defaultForumLayout" in oldAny && oldAny.defaultForumLayout !== newAny.defaultForumLayout) {
        changes.push(`• ${getEmojiTag("action_info")} Layout do fórum alterado`);
      }

      if (Array.isArray(oldAny.availableTags)) {
        const oldTags = oldAny.availableTags.map((t: any) => t.name).sort().join(",");
        const newTags = (newAny.availableTags || []).map((t: any) => t.name).sort().join(",");
        if (oldTags !== newTags) {
          changes.push(`• ${getEmojiTag("clipboard")} Tags do fórum alteradas`);
        }
      }

      if ("status" in oldAny && oldAny.status !== newAny.status) {
        changes.push(`• ${getEmojiTag("action_info")} Status de voz: \`${oldAny.status || "nenhum"}\` ➔ \`${newAny.status || "nenhum"}\``);
      }

      const overwriteDiffs = diffPermissionOverwrites(oldChannel, newChannel);
      if (overwriteDiffs > 0) {
        changes.push(`• ${getEmojiTag("lock")} Permissões: \`${overwriteDiffs}\` alvo(s) modificado(s)`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Canal Atualizado`,
        [
          `| ${getEmojiTag("folder")} <#${newChannel.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newChannel.guild, container);
    } catch (err) {
      console.error("[channelUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/channelUpdate.ts build/discord/events/channelUpdate.js
git commit -m "feat(logs): mais campos no log de canal (nsfw, bitrate, slowmode, forum, permissoes)"
```

---

### Task 11: Extensão do Log de Cargo (ícone)

**Files:**
- Modify: `src/discord/events/roleEvents.ts:63-110` (handler `roleUpdate`)

**Interfaces:**
- Consumes: mesmas do arquivo atual
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Adicionar o diff de ícone no handler `roleUpdate`**

Adicionar esta linha logo depois do bloco de `mentionable` (antes do bloco de `permissions.bitfield`):

```ts
      if (oldRole.icon !== newRole.icon) {
        changes.push(`• ${getEmojiTag("file")} Ícone do cargo atualizado`);
      }
```

O handler `roleUpdate` completo fica assim (trecho a partir do início da função):

```ts
createEvent({
  name: "roleUpdate",
  event: "roleUpdate",
  async run(oldRole: Role, newRole: Role) {
    try {
      const changes: string[] = [];

      if (oldRole.name !== newRole.name) {
        changes.push(`• ${getEmojiTag("action_info")} Nome: \`${oldRole.name}\` ➔ \`${newRole.name}\``);
      }

      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`• ${getEmojiTag("action_info")} Cor: \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
      }

      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`• ${getEmojiTag("action_info")} Exibir: \`${oldRole.hoist ? "Sim" : "Não"}\` ➔ \`${newRole.hoist ? "Sim" : "Não"}\``);
      }

      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`• ${getEmojiTag("action_info")} Mencionável: \`${oldRole.mentionable ? "Sim" : "Não"}\` ➔ \`${newRole.mentionable ? "Sim" : "Não"}\``);
      }

      if (oldRole.icon !== newRole.icon) {
        changes.push(`• ${getEmojiTag("file")} Ícone do cargo atualizado`);
      }

      if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        changes.push(`• ${getEmojiTag("shield")} Permissões modificadas`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newRole.guild,
        AuditLogEvent.RoleUpdate,
        newRole.id,
      );

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Cargo Atualizado`,
        [
          `| ${getEmojiTag("user_users")} <@&${newRole.id}>`,
          executor ? `| ${getEmojiTag("user_check")} <@${executor.id}>` : "",
          changes.join("\n"),
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newRole.guild, container);
    } catch (err) {
      console.error("[roleUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/roleEvents.ts build/discord/events/roleEvents.js
git commit -m "feat(logs): diff de icone no log de cargo atualizado"
```

---

### Task 12: Extensão do Log de Servidor

**Files:**
- Modify: `src/discord/events/guildUpdate.ts` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: mesmas do arquivo atual
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
import { createEvent } from "#base";
import { createContainer, createSection, Separator } from "@magicyan/discord";
import { AuditLogEvent, Guild } from "discord.js";
import { getAuditLogExecutor, getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "guildUpdate",
  event: "guildUpdate",
  async run(oldGuild: Guild, newGuild: Guild) {
    try {
      const changes: string[] = [];

      if (oldGuild.name !== newGuild.name) {
        changes.push(`• **Nome do Servidor:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
      }
      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`• **Ícone do Servidor:** O ícone do servidor foi atualizado.`);
      }
      if (oldGuild.banner !== newGuild.banner) {
        changes.push(`• **Banner do Servidor:** O banner do servidor foi atualizado.`);
      }
      if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(`• **Nível de Verificação:** \`${oldGuild.verificationLevel}\` ➔ \`${newGuild.verificationLevel}\``);
      }
      if (oldGuild.description !== newGuild.description) {
        changes.push(`• **Descrição:** alterada`);
      }
      if (oldGuild.splash !== newGuild.splash) {
        changes.push(`• **Splash:** atualizado`);
      }
      if (oldGuild.discoverySplash !== newGuild.discoverySplash) {
        changes.push(`• **Discovery Splash:** atualizado`);
      }
      if (oldGuild.ownerId !== newGuild.ownerId) {
        changes.push(`• **Dono do Servidor:** <@${oldGuild.ownerId}> ➔ <@${newGuild.ownerId}>`);
      }
      if (oldGuild.premiumTier !== newGuild.premiumTier) {
        changes.push(`• **Nível de Boost:** \`${oldGuild.premiumTier}\` ➔ \`${newGuild.premiumTier}\``);
      }
      if (oldGuild.premiumProgressBarEnabled !== newGuild.premiumProgressBarEnabled) {
        changes.push(`• **Barra de Progresso de Boost:** \`${newGuild.premiumProgressBarEnabled ? "Ativada" : "Desativada"}\``);
      }
      if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
        changes.push(`• **Canal de Updates Públicos:** alterado`);
      }
      if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
        changes.push(`• **Canal de Regras:** alterado`);
      }
      if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
        changes.push(`• **Canal do Sistema:** alterado`);
      }
      if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
        changes.push(`• **Canal AFK:** alterado`);
      }
      if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
        changes.push(`• **Timeout AFK:** \`${oldGuild.afkTimeout}s\` ➔ \`${newGuild.afkTimeout}s\``);
      }
      if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
        changes.push(`• **Vanity URL:** \`${oldGuild.vanityURLCode || "nenhuma"}\` ➔ \`${newGuild.vanityURLCode || "nenhuma"}\``);
      }
      if (oldGuild.verified !== newGuild.verified) {
        changes.push(`• **Verificado:** \`${newGuild.verified ? "Sim" : "Não"}\``);
      }
      if (oldGuild.partnered !== newGuild.partnered) {
        changes.push(`• **Parceiro Discord:** \`${newGuild.partnered ? "Sim" : "Não"}\``);
      }
      if (oldGuild.widgetEnabled !== newGuild.widgetEnabled) {
        changes.push(`• **Widget:** \`${newGuild.widgetEnabled ? "Ativado" : "Desativado"}\``);
      }
      if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
        changes.push(`• **Idioma Preferido:** \`${oldGuild.preferredLocale}\` ➔ \`${newGuild.preferredLocale}\``);
      }
      if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
        changes.push(`• **Filtro de Conteúdo Explícito:** \`${oldGuild.explicitContentFilter}\` ➔ \`${newGuild.explicitContentFilter}\``);
      }
      if (oldGuild.mfaLevel !== newGuild.mfaLevel) {
        changes.push(`• **Nível MFA (2FA para staff):** \`${oldGuild.mfaLevel}\` ➔ \`${newGuild.mfaLevel}\``);
      }

      const oldFeatures = [...oldGuild.features].sort().join(",");
      const newFeatures = [...newGuild.features].sort().join(",");
      if (oldFeatures !== newFeatures) {
        changes.push(`• **Recursos do Servidor:** alterados`);
      }

      if (changes.length === 0) return;

      const executor = await getAuditLogExecutor(
        newGuild,
        AuditLogEvent.GuildUpdate,
      );

      const timestamp = Math.floor(Date.now() / 1000);
      const icon =
        newGuild.iconURL() ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const container = createContainer(
        "#eab308",
        createSection({
          content: `## ${getEmojiTag("action_info")} Servidor Atualizado\nConfigurações de **${newGuild.name}** foram modificadas.`,
          thumbnail: icon as any,
        }),
        Separator.Default,
        [
          `| ${getEmojiTag("user_check")} **Alterado por:** ${executor ? `<@${executor.id}> (\`${executor.tag}\`)` : "*Não identificado*"}`,
          `| ${getEmojiTag("clock")} **Horário:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
        ].join("\n"),
        Separator.Default,
        `### Modificações:\n${changes.join("\n")}`,
      );

      await sendBotLog(newGuild, container);
    } catch (err) {
      console.error("[guildUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/guildUpdate.ts build/discord/events/guildUpdate.js
git commit -m "feat(logs): mais campos no log de servidor atualizado"
```

---

### Task 13: Log de Exclusão em Massa de Mensagens

**Files:**
- Modify: `src/discord/events/messageDelete.ts` (adiciona um novo `createEvent` no fim do arquivo)

**Interfaces:**
- Consumes: `GuildTextBasedChannel` (novo import de `discord.js`), mais o que já existe no arquivo
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Atualizar o import e adicionar o handler `messageDeleteBulk`**

Trocar a linha de import:

```ts
import { AuditLogEvent, Message, PartialMessage } from "discord.js";
```

por:

```ts
import { AuditLogEvent, GuildTextBasedChannel, Message, PartialMessage } from "discord.js";
```

E adicionar, no final do arquivo (depois do `createEvent` de `messageDelete` já existente):

```ts

createEvent({
  name: "messageDeleteBulk",
  event: "messageDeleteBulk",
  async run(messages: any, channel: GuildTextBasedChannel) {
    if (!channel.guild) return;

    try {
      const executor = await getAuditLogExecutor(
        channel.guild,
        AuditLogEvent.MessageBulkDelete,
        channel.id,
      );

      const container = createContainer(
        "#ef4444",
        `## ${getEmojiTag("action_x")} Mensagens Excluídas em Massa`,
        [
          `| ${getEmojiTag("folder")} <#${channel.id}>`,
          `| ${getEmojiTag("file_remove")} \`${messages.size}\` mensagens apagadas`,
          executor ? `| ${getEmojiTag("user_remove")} <@${executor.id}>` : "",
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(channel.guild, container);
    } catch (err) {
      console.error("[messageDeleteBulk] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/messageDelete.ts build/discord/events/messageDelete.js
git commit -m "feat(logs): log de exclusao em massa de mensagens"
```

---

### Task 14: Log de Enquete Finalizada

**Files:**
- Modify: `src/discord/events/messageUpdate.ts` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: mesmas do arquivo atual
- Produces: nada consumido por outras tasks

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
import { createEvent } from "#base";
import { createContainer } from "@magicyan/discord";
import { Message, PartialMessage } from "discord.js";
import { getEmojiTag, sendBotLog } from "#functions";

createEvent({
  name: "messageUpdate",
  event: "messageUpdate",
  async run(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage,
  ) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    // Enquete finalizada: o texto da mensagem não muda, só o campo
    // poll.resultsFinalized — tratado separado do diff de conteúdo abaixo.
    if (
      !oldMessage.partial &&
      oldMessage.poll &&
      newMessage.poll &&
      !oldMessage.poll.resultsFinalized &&
      newMessage.poll.resultsFinalized
    ) {
      try {
        const container = createContainer(
          constants.colors.primary,
          `## ${getEmojiTag("action_check")} Enquete Finalizada`,
          [
            `| Canal: <#${newMessage.channelId}>`,
            `| \`${newMessage.poll.question.text || "Enquete"}\``,
            `| [Ir para a mensagem](${newMessage.url})`,
          ].join("\n"),
        );
        await sendBotLog(newMessage.guild, container);
      } catch (err) {
        console.error("[messageUpdate] Erro ao registrar log de enquete:", err);
      }
    }

    // Sem a versão antiga no cache não dá para saber se houve edição: só segue
    // se a edição é recente (evita logar atualização de prévia de link).
    if (oldMessage.partial) {
      const editedAt = newMessage.editedTimestamp;
      if (!editedAt || Date.now() - editedAt > 30_000) return;
    }

    const oldContent = oldMessage.content?.trim();
    const newContent = newMessage.content?.trim();

    if (oldContent === newContent) return;
    if (!oldContent && !newContent) return;

    try {
      const author = newMessage.author;
      const beforeText = oldMessage.partial
        ? "*indisponível (mensagem fora do cache)*"
        : oldContent || "*vazio*";
      const afterText = newContent || "*vazio*";

      const container = createContainer(
        "#eab308",
        `## ${getEmojiTag("action_info")} Mensagem Editada`,
        [
          `| Canal: <#${newMessage.channelId}>`,
          author ? `| Autor: <@${author.id}>` : "",
          `| [Ir para a mensagem](${newMessage.url})`,
          `**Antes:**\n\`\`\`${beforeText.slice(0, 300)}\`\`\``,
          `**Depois:**\n\`\`\`${afterText.slice(0, 300)}\`\`\``,
        ].filter(Boolean).join("\n"),
      );

      await sendBotLog(newMessage.guild, container);
    } catch (err) {
      console.error("[messageUpdate] Erro ao registrar log:", err);
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: `✔ Ok`

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/discord/events/messageUpdate.ts build/discord/events/messageUpdate.js
git commit -m "feat(logs): log de enquete finalizada"
```

---

### Task 15: Deploy e verificação em produção

**Files:** nenhum (task de operação, não de código)

**Interfaces:**
- Consumes: todas as 14 tasks anteriores já commitadas
- Produces: bot em produção com todos os logs novos ativos

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Deploy na Discloud**

```bash
npx discloud app commit 1788907433488
```

Expected: `[info] [Discloud API: 200] Os arquivos do seu aplicativo foram atualizados com sucesso.`

- [ ] **Step 3: Confirmar que o bot reiniciou e está online**

```bash
TOKEN=$(grep -m1 '^DISCLOUD_TOKEN=' .env | cut -d= -f2- | tr -d '\r"')
sleep 8
curl -s -H "api-token: $TOKEN" "https://api.discloud.app/v2/app/1788907433488/status"
```

Expected: JSON com `"container":"Online"` e um `startedAt` recente (segundos atrás).

---

## Nota: escopo deste plano

Este plano cobre só o bot **Prism**. Dusk e Sirens recebem planos próprios
depois que este for revisado e implementado — o código de Dusk é quase
idêntico ao do Prism (mesmas convenções de emoji/cor), então aquele plano
deve ser rápido de gerar; o de Sirens precisa adaptar nomes de emoji e
cores próprias da Sirens.
