import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    WEB_ORIGINS: z
        .string()
        .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
        .pipe(z.array(z.url()).min(1)),
});

export const env = envSchema.parse(process.env); // crashes at boot on bad config