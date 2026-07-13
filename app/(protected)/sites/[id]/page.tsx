import type { Metadata } from "next";

import { SiteDetailClient } from "@/components/dashboard/site-detail-client";

export const metadata: Metadata = { title: "Site" };

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SiteDetailClient id={id} />;
}
