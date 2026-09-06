import { MongoClient, Db } from "mongodb";

function cleanUri(val?: string): string | null {
  if (!val) return null;
  const cleaned = val.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned || null;
}

function getUri(): string {
  const uri = cleanUri(process.env.MONGODB_URI) || cleanUri(process.env.MONGO_URI);
  if (!uri) {
    throw new Error(
      "Please add your MongoDB URI (MONGODB_URI or MONGO_URI) to environment variables",
    );
  }
  return uri;
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = getUri();

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export default function getClient() {
  return getClientPromise();
}

export async function getDatabase(): Promise<Db> {
  const c = await getClientPromise();
  return c.db(process.env.DATABASE_NAME || "database");
}
