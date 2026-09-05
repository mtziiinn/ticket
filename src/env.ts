import { validateEnv } from "@constatic/base";
import { z } from "zod";
import "./constants.js";

export const env = await validateEnv(
  z.looseObject({
    BOT_TOKEN: z.string("Discord Bot Token is required").min(1),
    MONGO_URI: z.string("MongoDb URI is required").min(1),
    DATABASE_NAME: z.string().optional(),
    WEB_URL: z.string().url().default("http://localhost:3000"),
    MP_ACCESS_TOKEN: z.string().optional(),
  }),
);
