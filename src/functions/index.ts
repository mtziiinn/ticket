export function formatEmoji(emojiRaw: string | null | undefined): any {
  if (!emojiRaw) return undefined;
  if (/^\d+$/.test(emojiRaw)) {
    return { id: emojiRaw };
  }
  return emojiRaw;
}