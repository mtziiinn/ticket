export function formatEmoji(emojiRaw) {
    if (!emojiRaw)
        return undefined;
    if (/^\d+$/.test(emojiRaw)) {
        return { id: emojiRaw };
    }
    return emojiRaw;
}
