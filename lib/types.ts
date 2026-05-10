export interface TranscriptMessage {
  id: string
  messageId: string
  authorId: string
  authorUsername: string
  authorAvatar?: string
  authorBot: boolean
  isStaff: boolean
  content: string
  timestamp: string
  attachments?: Array<{
    url: string
    filename: string
    contentType?: string
  }>
  embeds?: Array<{
    title?: string
    description?: string
    color?: number
  }>
}

export interface Transcript {
  id: string
  guildId: string
  guildName?: string
  channelId: string
  channelName?: string
  category: string
  createdAt: string
  closedAt?: string
  openedBy: {
    id: string
    username: string
    avatar?: string
  }
  closedBy?: {
    id: string
    username: string
    avatar?: string
  }
  messageCount: number
  messages: TranscriptMessage[]
}

// Tipo para criar um novo transcript via API
export interface CreateTranscriptPayload {
  id: string
  guildId: string
  guildName?: string
  channelId: string
  channelName?: string
  category?: string
  createdAt: string
  closedAt?: string
  openedBy: {
    id: string
    username: string
    avatar?: string
  }
  closedBy?: {
    id: string
    username: string
    avatar?: string
  }
  messages: Array<{
    id: string
    authorId: string
    authorUsername: string
    authorAvatar?: string
    authorBot?: boolean
    isStaff?: boolean
    content: string
    timestamp: string
    attachments?: Array<{
      url: string
      filename: string
      contentType?: string
    }>
    embeds?: Array<{
      title?: string
      description?: string
      color?: number
    }>
  }>
}
