"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSiteSchema, type CreateSiteValues } from "@/lib/validations/site";
import { mapSiteRow, type SiteRow } from "@/lib/data/sites";
import type { Site } from "@/app/(protected)/_lib/types";

export async function createSite(
  input: CreateSiteValues
): Promise<{ site?: Site; error?: string }> {
  const validated = createSiteSchema.safeParse(input);
  if (!validated.success) {
    return { error: "Please check the site details and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a site." };
  }

  const domain = validated.data.domain.trim().replace(/^https?:\/\//, "");

  const { data, error } = await supabase.rpc("create_site", {
    name: validated.data.name.trim(),
    domain,
    primary_color: validated.data.primaryColor,
  });

  if (error || !data) {
    console.error(error);
    return { error: "Could not create the site. Please try again." };
  }

  revalidatePath("/overview");

  return { site: mapSiteRow(data as SiteRow) };
}
