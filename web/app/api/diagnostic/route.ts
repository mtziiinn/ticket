import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

function maskUri(uri?: string) {
  if (!uri) return null;
  const trimmed = uri.trim();
  const hadQuotes = uri.startsWith('"') || uri.startsWith("'");
  const hadWhitespace = uri !== trimmed;
  // Match mongodb+srv://username:password@host...
  const match = trimmed.replace(/^["']|["']$/g, "").match(/^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^/?]+)(.*)$/);
  if (!match) return { rawLength: uri.length, validFormat: false, hadQuotes, hadWhitespace };
  const [, user, pass, host, rest] = match;
  return {
    validFormat: true,
    user,
    passLength: pass.length,
    passFirstChar: pass.charAt(0),
    passLastChar: pass.charAt(pass.length - 1),
    host,
    rest,
    hadQuotes,
    hadWhitespace,
  };
}

export async function GET() {
  const rawMongoDbUri = process.env.MONGODB_URI;
  const rawMongoUri = process.env.MONGO_URI;

  const envCheck = {
    MONGODB_URI_INFO: maskUri(rawMongoDbUri),
    MONGO_URI_INFO: maskUri(rawMongoUri),
    DATABASE_NAME: process.env.DATABASE_NAME || "database (default)",
    NODE_ENV: process.env.NODE_ENV,
  };

  const urisToTry = [
    { source: "MONGO_URI", uri: rawMongoUri?.trim().replace(/^["']|["']$/g, "") },
    { source: "MONGODB_URI", uri: rawMongoDbUri?.trim().replace(/^["']|["']$/g, "") },
  ].filter((item) => Boolean(item.uri));

  const results: any[] = [];

  for (const item of urisToTry) {
    try {
      const client = new MongoClient(item.uri!);
      await client.connect();
      const db = client.db(process.env.DATABASE_NAME || "database");
      const count = await db.collection("transcripts").countDocuments();
      const recent = await db
        .collection("transcripts")
        .find({}, { projection: { id: 1, channelName: 1 } })
        .sort({ _id: -1 })
        .limit(2)
        .toArray();
      await client.close();

      results.push({
        source: item.source,
        success: true,
        databaseName: db.databaseName,
        transcriptsCount: count,
        recent,
      });
    } catch (err: any) {
      results.push({
        source: item.source,
        success: false,
        errorName: err.name,
        errorMessage: err.message,
      });
    }
  }

  const anySuccess = results.some((r) => r.success);

  return NextResponse.json(
    {
      status: anySuccess ? "success" : "auth_error",
      env: envCheck,
      connectionAttempts: results,
    },
    { status: anySuccess ? 200 : 500 },
  );
}
