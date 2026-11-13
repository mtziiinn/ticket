// Nome do canal do ticket: "<emoji>・[<extras>・]<slug>".
// Os "extras" são segmentos do meio que não pertencem a este bot — hoje é o
// número da fila (ex.: "🟣・4・sebastian", colocado pela Dusk, que roda no
// mesmo servidor). Alterar o status deve mexer SÓ na bolinha/emoji; o resto do
// nome tem que ficar exatamente como está.
const SEPARATOR = "・";
export function parseTicketChannelName(name) {
    const parts = name.split(SEPARATOR);
    if (parts.length === 1) {
        // Sem separador: pode ser um nome renomeado na mão ("ticket-vixie") ou só
        // um emoji solto (canal que já foi quebrado antes). Só tratamos como
        // emoji quando não há nenhuma letra/número no nome.
        const onlyEmoji = !/[\p{L}\p{N}]/u.test(name);
        return onlyEmoji
            ? { emoji: name, extras: [], slug: "" }
            : { emoji: "", extras: [], slug: name };
    }
    const emoji = parts.shift() ?? "";
    const slug = parts.pop() ?? "";
    return { emoji, extras: parts, slug };
}
export function buildTicketChannelName(emoji, extras, slug) {
    const parts = [emoji || "🎫", ...extras];
    if (slug)
        parts.push(slug);
    return parts.join(SEPARATOR);
}
// Troca apenas a "bolinha" do status (primeiro segmento) e preserva o resto
// do nome — inclusive nomes renomeados na mão, que podem não ter separador.
export function withStatusEmoji(currentName, emoji) {
    const { extras, slug } = parseTicketChannelName(currentName);
    return buildTicketChannelName(emoji, extras, slug);
}
