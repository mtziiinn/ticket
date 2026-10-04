export interface TranscriptMessage {
  id: string;
  messageId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar?: string;
  authorBot: boolean;
  isStaff: boolean;
  content: string;
  timestamp: string;
  attachments?: Array<{
    url: string;
    filename: string;
    contentType?: string;
    width?: number;
    height?: number;
  }>;
  embeds?: TranscriptEmbed[];
  components?: TranscriptComponent[];
  mentions?: TranscriptMentions;
}

/** Nomes das menções encontradas no texto da mensagem: id -> nome. */
export interface TranscriptMentions {
  users?: Record<string, string>;
  roles?: Record<string, string>;
  channels?: Record<string, string>;
}

export interface TranscriptEmoji {
  id?: string;
  name?: string;
  animated?: boolean;
}

/** Componentes V2 do Discord, simplificados pelo bot (transcriptMessage.ts). */
export type TranscriptComponent =
  | {
      type: "container";
      accentColor?: number;
      spoiler?: boolean;
      components: TranscriptComponent[];
    }
  | { type: "section"; components: TranscriptComponent[]; accessory?: TranscriptComponent }
  | { type: "text"; content: string }
  | { type: "thumbnail"; url: string; description?: string }
  | { type: "gallery"; items: Array<{ url: string; description?: string }> }
  | { type: "file"; url: string; name?: string }
  | { type: "separator"; divider: boolean; spacing: "small" | "large" }
  | { type: "row"; components: TranscriptComponent[] }
  | {
      type: "button";
      style: number;
      label?: string;
      emoji?: TranscriptEmoji;
      url?: string;
      disabled?: boolean;
    }
  | { type: "select"; placeholder?: string; disabled?: boolean };

export interface TranscriptEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  image?: string;
  thumbnail?: string;
  timestamp?: string;
  author?: {
    name: string;
    url?: string;
    iconURL?: string;
  };
  footer?: {
    text: string;
    iconURL?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export interface Transcript {
  id: string;
  guildId: string;
  guildName?: string;
  channelId: string;
  channelName?: string;
  category: string;
  description?: string;
  createdAt: string;
  closedAt?: string;
  openedBy: {
    id: string;
    username: string;
    avatar?: string;
  };
  closedBy?: {
    id: string;
    username: string;
    avatar?: string;
  };
  claimedBy?: {
    id: string;
    username: string;
    avatar?: string;
  };
  deliveries?: Array<{
    url: string;
    filename: string;
    description?: string;
    deliveredBy: string;
    deliveredAt: string;
  }>;
  messageCount: number;
  messages: TranscriptMessage[];
}

export interface Delivery {
  url: string;
  filename: string;
  description: string;
  deliveredBy: string;
  deliveredAt: string;
  expired?: boolean;
  expiresAt?: string;
}

export interface PendingDelivery {
  token: string;
  channelId: string;
  staffId: string;
  description: string;
  ticketId: string;
  status: "pending" | "completed";
  url: string | null;
  filename: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TicketWithDeliveries {
  ticketId: string;
  category: string;
  description: string;
  createdAt: string;
  deliveries: Delivery[];
}

// Tipo para criar um novo transcript via API
export interface CreateTranscriptPayload {
  id: string;
  guildId: string;
  guildName?: string;
  channelId: string;
  channelName?: string;
  category?: string;
  description?: string;
  createdAt: string;
  closedAt?: string;
  openedBy: {
    id: string;
    username: string;
    avatar?: string;
  };
  closedBy?: {
    id: string;
    username: string;
    avatar?: string;
  };
  messages: Array<{
    id: string;
    authorId: string;
    authorUsername: string;
    authorAvatar?: string;
    authorBot?: boolean;
    isStaff?: boolean;
    content: string;
    timestamp: string;
    attachments?: Array<{
      url: string;
      filename: string;
      contentType?: string;
      width?: number;
      height?: number;
    }>;
    embeds?: TranscriptEmbed[];
    components?: TranscriptComponent[];
    mentions?: TranscriptMentions;
  }>;
}
