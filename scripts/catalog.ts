// Shared client for the live endpoint catalog. Both gen-examples.ts and
// gen-reference.ts read the same catalog, so this is the one place that fetches it.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface CatalogEndpoint {
  id: string;
  title?: string;
  summary: string;
  bestWhen?: string | null;
  method: "GET" | "POST";
  path: string;
  credits?: number;
  pricing?: string | null;
  keyless?: boolean;
  input?: JsonObject;
  example?: JsonObject;
}

export interface CatalogSource {
  id: string;
  summary: string;
}

export interface Catalog {
  sources: CatalogSource[];
  endpoints: CatalogEndpoint[];
}

export const CATALOG_URL = process.env.STOPHY_CATALOG_URL ?? "https://api.stophy.dev/v1/endpoints";

// The catalog is either the live URL or, for a catalog saved before the API ships,
// a path to a JSON file holding the endpoint list (STOPHY_CATALOG_URL=./catalog.json).
export async function fetchCatalog(): Promise<Catalog> {
  if (!/^https?:/.test(CATALOG_URL)) {
    const saved = (await Bun.file(CATALOG_URL).json()) as Catalog | CatalogEndpoint[];
    return Array.isArray(saved) ? { sources: [], endpoints: saved } : saved;
  }
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`GET ${CATALOG_URL} returned ${response.status}`);
  return (await response.json()) as Catalog;
}

export const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
