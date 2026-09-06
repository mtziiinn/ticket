import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export async function GET() {
  const envCheck = {
    has_MONGODB_URI: Boolean(process.env.MONGODB_URI),
    has_MONGO_URI: Boolean(process.env.MONGO_URI),
    DATABASE_NAME: process.env.DATABASE_NAME || "database (default)",
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    const db = await getDatabase();
    const count = await db.collection("transcripts").countDocuments();
    const recent = await db
      .collection("transcripts")
      .find({}, { projection: { id: 1, channelName: 1 } })
      .sort({ _id: -1 })
      .limit(3)
      .toArray();

    return NextResponse.json({
      status: "connected",
      databaseName: db.databaseName,
      transcriptsCount: count,
      recentTranscripts: recent,
      env: envCheck,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        errorName: error?.name,
        errorMessage: error?.message,
        env: envCheck,
      },
      { status: 500 },
    );
  }
}
