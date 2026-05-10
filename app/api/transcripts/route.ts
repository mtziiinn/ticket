import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { CreateTranscriptPayload, Transcript } from "@/lib/types"

// POST - Criar novo transcript (chamado pelo bot Discord)
export async function POST(request: NextRequest) {
  try {
    // Verificar API Key
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const payload: CreateTranscriptPayload = await request.json()

    // Validar campos obrigatorios
    if (!payload.id || !payload.guildId || !payload.channelId || !payload.openedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<Transcript>("transcripts")

    // Preparar documento para inserir
    const transcript: Transcript = {
      id: payload.id,
      guildId: payload.guildId,
      guildName: payload.guildName,
      channelId: payload.channelId,
      channelName: payload.channelName,
      category: payload.category || "Suporte",
      createdAt: payload.createdAt,
      closedAt: payload.closedAt,
      openedBy: payload.openedBy,
      closedBy: payload.closedBy,
      messageCount: payload.messages.length,
      messages: payload.messages.map((msg, index) => ({
        id: `${payload.id}-${index}`,
        messageId: msg.id,
        authorId: msg.authorId,
        authorUsername: msg.authorUsername,
        authorAvatar: msg.authorAvatar,
        authorBot: msg.authorBot || false,
        isStaff: msg.isStaff || false,
        content: msg.content,
        timestamp: msg.timestamp,
        attachments: msg.attachments,
        embeds: msg.embeds,
      })),
    }

    // Usar upsert para permitir atualizar se ja existir
    await collection.updateOne(
      { id: payload.id },
      { $set: transcript },
      { upsert: true }
    )

    const transcriptUrl = `${request.nextUrl.origin}/transcripts/${payload.id}`

    return NextResponse.json({
      success: true,
      id: payload.id,
      url: transcriptUrl,
    })
  } catch (error) {
    console.error("Error creating transcript:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - Listar transcripts (opcional, para admin)
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const guildId = searchParams.get("guildId")
    const limit = parseInt(searchParams.get("limit") || "20")

    const db = await getDatabase()
    const collection = db.collection<Transcript>("transcripts")

    const query = guildId ? { guildId } : {}
    const transcripts = await collection
      .find(query, { projection: { messages: 0 } }) // Excluir mensagens da listagem
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({ transcripts })
  } catch (error) {
    console.error("Error listing transcripts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
