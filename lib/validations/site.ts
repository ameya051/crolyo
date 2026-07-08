import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().min(1, "Site name is required").max(100, "Site name is too long"),
  domain: z
    .string()
    .min(1, "Domain is required")
    .refine(
      (value) => /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/.test(value),
      "Enter a valid domain like example.com"
    ),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Enter a valid hex color"),
});

export type CreateSiteValues = z.infer<typeof createSiteSchema>;
