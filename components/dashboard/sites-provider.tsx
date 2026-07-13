"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Site } from "@/app/(protected)/_lib/types";
import {
  createSite as createSiteRequest,
  deleteSite as deleteSiteRequest,
  listSites,
  updateSite as updateSiteRequest,
  type CreateSiteRequest,
  type DeleteSiteRequest,
  type UpdateSiteRequest,
} from "@/lib/api/sitesApi";

type SitesContextValue = {
  sites: Site[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSite: (input: CreateSiteRequest) => ReturnType<typeof createSiteRequest>;
  updateSite: (input: UpdateSiteRequest) => ReturnType<typeof updateSiteRequest>;
  deleteSite: (input: DeleteSiteRequest) => ReturnType<typeof deleteSiteRequest>;
};

const SitesContext = createContext<SitesContextValue | null>(null);

function replaceSite(sites: Site[], site: Site) {
  return sites.map((item) => (item.id === site.id ? site : item));
}

export function SitesProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await listSites();
    if (result.error) {
      setError(result.error);
    } else {
      setSites(result.sites);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSite = useCallback(async (input: CreateSiteRequest) => {
    const result = await createSiteRequest(input);
    if (result.site) setSites((current) => [result.site, ...current]);
    return result;
  }, []);

  const updateSite = useCallback(async (input: UpdateSiteRequest) => {
    const result = await updateSiteRequest(input);
    if (result.site) setSites((current) => replaceSite(current, result.site));
    return result;
  }, []);

  const deleteSite = useCallback(async (input: DeleteSiteRequest) => {
    const result = await deleteSiteRequest(input);
    if (result.ok) setSites((current) => current.filter((site) => site.id !== input.id));
    return result;
  }, []);

  const value = useMemo(
    () => ({ sites, isLoading, error, refresh, createSite, updateSite, deleteSite }),
    [sites, isLoading, error, refresh, createSite, updateSite, deleteSite]
  );

  return <SitesContext.Provider value={value}>{children}</SitesContext.Provider>;
}

export function useSites() {
  const context = useContext(SitesContext);
  if (!context) throw new Error("useSites must be used within a SitesProvider");
  return context;
}
