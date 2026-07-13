import { z } from "zod";

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Enter a valid hex color");
const domain = z
  .string()
  .min(1, "Domain is required")
  .refine((value) => DOMAIN_REGEX.test(value), "Enter a valid domain like example.com");

export const createSiteSchema = z.object({
  name: z.string().min(1, "Site name is required").max(100, "Site name is too long"),
  domain,
  primaryColor: hexColor,
});

export type CreateSiteValues = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = z.object({
  id: z.string().uuid("Invalid site id"),
  name: z.string().min(1, "Site name is required").max(100, "Site name is too long"),
  domain,
  allowedDomains: z.array(domain).max(20, "Too many domains").default([]),
  primaryColor: hexColor,
  welcomeMessage: z.string().max(500, "Welcome message is too long").default(""),
});

export type UpdateSiteValues = z.infer<typeof updateSiteSchema>;

export const deleteSiteSchema = z.object({
  id: z.string().uuid("Invalid site id"),
});

export type DeleteSiteValues = z.infer<typeof deleteSiteSchema>;
