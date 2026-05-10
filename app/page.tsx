import { TranscriptViewer } from "@/components/transcript/transcript-viewer"
import type { Transcript } from "@/lib/types"

// Dados de exemplo para preview
const sampleTranscript: Transcript = {
  id: "380GACM",
  guildId: "123456789",
  guildName: "Code Studio",
  channelId: "987654321",
  channelName: "ticket-mts-boss",
  category: "Suporte",
  createdAt: "2026-05-10T00:07:00.000Z",
  closedAt: "2026-05-10T01:26:00.000Z",
  messageCount: 3,
  openedBy: {
    id: "111111111",
    username: "1939 | Mts Boss",
    avatar: undefined,
  },
  closedBy: {
    id: "222222222",
    username: "MOD Coruja",
    avatar: undefined,
  },
  messages: [
    {
      id: "380GACM-0",
      messageId: "msg001",
      authorId: "222222222",
      authorUsername: "MOD Coruja",
      authorAvatar: undefined,
      authorBot: false,
      isStaff: true,
      content: "Ola, tudo bem? Meu nome e Coruja e vou te auxiliar no seu ticket. Poderia me explicar exatamente o que esta acontecendo?",
      timestamp: "2026-05-10T01:17:00.000Z",
    },
    {
      id: "380GACM-1",
      messageId: "msg002",
      authorId: "111111111",
      authorUsername: "1939 | Mts Boss",
      authorAvatar: undefined,
      authorBot: false,
      isStaff: false,
      content: "ja resolvi vlw",
      timestamp: "2026-05-10T01:21:00.000Z",
    },
    {
      id: "380GACM-2",
      messageId: "msg003",
      authorId: "222222222",
      authorUsername: "MOD Coruja",
      authorAvatar: undefined,
      authorBot: false,
      isStaff: true,
      content: "Caso ainda precise de ajuda, sinta-se a vontade para abrir um novo ticket. Estamos a disposicao!",
      timestamp: "2026-05-10T01:22:00.000Z",
    },
  ],
}

export default function HomePage() {
  return <TranscriptViewer transcript={sampleTranscript} />
}
