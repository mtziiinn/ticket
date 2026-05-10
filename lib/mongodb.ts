import { MongoClient, Db } from "mongodb"

const uri = process.env.MONGODB_URI || ""
const options = {}

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error("Please add your MongoDB URI to environment variables")
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    return global._mongoClientPromise
  }

  if (!clientPromise) {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
  return clientPromise
}

export default getClientPromise

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise()
  return client.db("transcripts")
}
