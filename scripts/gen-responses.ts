// Turns saved live responses into the short example responses shown on each
// endpoint page. Run with:
//   STOPHY_CATALOG_URL=<catalog> STOPHY_LIVE_DIR=<dir> bun scripts/gen-responses.ts
// <dir> holds one <endpoint id>.json per call, each { "input": ..., "output": ... },
// where output is the `data` of a real response.
// Output: scripts/responses/<id>.json, { "live": true, "creditsUsed": n, "data": ... }.
// An endpoint with no saved call, or a call that returned nothing, keeps a
// hand-written sample there with "live": false.

import { type Json, type JsonObject, fetchCatalog, isObject } from "./catalog";

const root = new URL("..", import.meta.url);
const liveDir = process.env.STOPHY_LIVE_DIR;
if (liveDir === undefined) throw new Error("Set STOPHY_LIVE_DIR to the folder with the saved calls.");

const MAX_STRING = 120;
const PRIVATE_FIELDS = new Set(["agentName", "agentPhone", "agentEmail", "developerEmail"]);

const isEmpty = (value: Json) =>
  value === null || value === "" || (Array.isArray(value) && value.length === 0) || (isObject(value) && Object.keys(value).length === 0);

const kindOf = (item: Json) => {
  if (!isObject(item)) return undefined;
  const kind = item.type ?? item.kind;
  return typeof kind === "string" ? kind : undefined;
};

// The API leaves out empty values, so the example does too.
function clean(value: Json): Json {
  if (Array.isArray(value)) return value.map(clean).filter((item) => !isEmpty(item));
  if (isObject(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => !PRIVATE_FIELDS.has(key))
      .map(([key, item]) => [key, clean(item)] as const)
      .filter(([, item]) => !isEmpty(item));
    return Object.fromEntries(entries);
  }
  return value;
}

// One row of each top-level list, or one row of each of the first two kinds when a list mixes kinds.
function rows(list: Json[]): Json[] {
  const kinds = [...new Set(list.map(kindOf))];
  if (kinds.length < 2 || kinds[0] === undefined) return list.slice(0, 1);
  return kinds.slice(0, 2).flatMap((kind) => list.filter((item) => kindOf(item) === kind).slice(0, 1));
}

function shorten(value: Json, top: boolean): Json {
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value;
  if (Array.isArray(value)) {
    const kept = top ? rows(value) : value.slice(0, value.every(isObject) ? 1 : 2);
    return kept.map((item) => shorten(item, false));
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shorten(item, false)]));
  }
  return value;
}

function trim(data: JsonObject): JsonObject {
  const cleaned = clean(data) as JsonObject;
  return Object.fromEntries(Object.entries(cleaned).map(([key, item]) => [key, shorten(item, true)]));
}

const itemCount = (data: JsonObject) =>
  Object.values(data).filter(Array.isArray).reduce((most, list) => Math.max(most, list.length), 0);

// What the call cost: the base price, more for priced-per-N results or transcribed audio.
function creditsUsed(pricing: string | null | undefined, credits: number, data: JsonObject): number {
  const per = pricing?.match(/(\d+) credits? per (\d+)/);
  if (per !== null && per !== undefined) return Math.max(credits, Math.ceil(itemCount(data) / Number(per[2])) * Number(per[1]));
  const seconds = data.transcribedSeconds;
  if (typeof seconds === "number") return 2 + Math.ceil(seconds / 10);
  return credits;
}

const catalog = await fetchCatalog();
let written = 0;
for (const op of catalog.endpoints) {
  const saved = Bun.file(`${liveDir}/${op.id}.json`);
  if (!(await saved.exists())) continue;
  const { output } = (await saved.json()) as { output: JsonObject };
  const data = trim(output);
  if (Object.keys(data).length === 0) continue;
  const body = { live: true, creditsUsed: creditsUsed(op.pricing, op.credits ?? 1, output), data };
  await Bun.write(new URL(`scripts/responses/${op.id}.json`, root), `${JSON.stringify(body, null, 2)}\n`);
  written += 1;
}
console.log(`Wrote ${written} example responses.`);
