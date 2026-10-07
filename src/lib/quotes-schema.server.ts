import { z } from "zod";
import { MAX_PACKAGES, QUOTE_CURRENCIES } from "./quotes";

const text = (max: number) => z.string().trim().max(max);

export const quoteInput = z.object({
  prepared_by: text(160).min(1),
  client_name: text(160),
  project_title: text(200),
  intro: text(1500),
  currency: z.enum(QUOTE_CURRENCIES),
  packages: z
    .array(
      z.object({
        name: text(80).min(1, "Give every package a name"),
        price: z.number().min(0).max(100_000_000),
        delivery: text(80),
        features: z
          .array(text(200))
          .max(20)
          .transform((f) => f.filter(Boolean)),
        recommended: z.boolean(),
      }),
    )
    .min(1, "Add at least one package")
    .max(MAX_PACKAGES),
  notes: text(2000),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
export type QuoteInput = z.infer<typeof quoteInput>;
