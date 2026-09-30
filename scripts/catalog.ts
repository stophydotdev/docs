// Shared client for the live endpoint catalog. Both gen-examples.ts and
// gen-reference.ts read the same catalog, so this is the one place that fetches it.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface CatalogEndpoint {
  id: string;
  summary: string;
  method: "GET" | "POST";
  path: string;
  credits?: number;
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

export async function fetchCatalog(): Promise<Catalog> {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`GET ${CATALOG_URL} returned ${response.status}`);
  return (await response.json()) as Catalog;
}

export const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
