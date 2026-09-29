// Checks that the source names and endpoint titles in reference.config.json
// match the live catalog, which is their single source of truth. Run with
// `bun scripts/check-titles.ts`. Once the catalog serves titles, gen-reference.ts
// should read them from it and this map and check can be deleted.

import { fetchCatalog } from "./catalog";

interface Config {
  sources: Record<string, string>;
  titles: Record<string, string>;
}

const config = (await Bun.file(new URL("./reference.config.json", import.meta.url)).json()) as Config;
const catalog = (await fetchCatalog()) as unknown as {
  sources: { id: string; name?: string }[];
  endpoints: { id: string; title?: string }[];
};

if (catalog.endpoints.every((endpoint) => endpoint.title === undefined)) {
  console.log("The live catalog does not serve titles yet, so there is nothing to compare.");
  process.exit(0);
}

const problems = [
  ...catalog.sources
    .filter((source) => config.sources[source.id] !== source.name)
    .map((source) => `source ${source.id}: config "${config.sources[source.id]}", catalog "${source.name}"`),
  ...catalog.endpoints
    .filter((endpoint) => config.titles[endpoint.id] !== endpoint.title)
    .map((endpoint) => `endpoint ${endpoint.id}: config "${config.titles[endpoint.id]}", catalog "${endpoint.title}"`),
  ...Object.keys(config.titles)
    .filter((id) => !catalog.endpoints.some((endpoint) => endpoint.id === id))
    .map((id) => `endpoint ${id}: in config but not in the catalog`),
];

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Titles match the catalog: ${catalog.endpoints.length} endpoints, ${catalog.sources.length} sources.`);
