import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    WEB_ORIGIN: z.url(),
});

export const env = envSchema.parse(process.env); // crashes at boot on bad config