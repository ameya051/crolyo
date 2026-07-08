"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, ChevronDownIcon, LayoutGridIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Site } from "@/app/(protected)/_lib/types";
import { cn } from "@/lib/utils";

export function SiteSwitcher({ sites }: { sites: Site[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const match = pathname.match(/^\/sites\/([^/]+)/);
  const currentSiteId = match?.[1];
  const currentSite = sites.find((s) => s.id === currentSiteId);
  const label = currentSite ? currentSite.name : "Overview";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-9 gap-2 rounded-lg px-3 text-sm font-medium"
          />
        }
      >
        {currentSite ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: currentSite.primaryColor }}
            aria-hidden
          />
        ) : null}
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your sites</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => router.push("/overview")}
            className={cn(!currentSite && "text-primary")}
          >
            <LayoutGridIcon className="size-4" />
            <span>Overview</span>
            {!currentSite ? (
              <CheckIcon className="ml-auto size-3.5 text-primary" />
            ) : null}
          </DropdownMenuItem>
          {sites.map((site) => {
            const isActive = site.id === currentSiteId;
            return (
              <DropdownMenuItem
                key={site.id}
                onClick={() => router.push(`/sites/${site.id}`)}
                className={cn(isActive && "text-primary")}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: site.primaryColor }}
                  aria-hidden
                />
                <span className="truncate">{site.name}</span>
                {isActive ? (
                  <CheckIcon className="ml-auto size-3.5 text-primary" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/sites/new" />}>
          <PlusIcon className="size-4" />
          <span>Add new site</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
