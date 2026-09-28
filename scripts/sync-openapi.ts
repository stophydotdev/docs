const source = process.env.STOPHY_OPENAPI_URL ?? "https://api.stophy.dev/openapi.json";
const target = new URL("../api-reference/openapi.json", import.meta.url);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const KEYLESS_SENTENCE = / ?Works without an API key, within free limits\./g;

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const keyedOnly = (security: Json | undefined): Json | undefined =>
  Array.isArray(security)
    ? security.filter((entry) => !(isObject(entry) && Object.keys(entry).length === 0))
    : security;

const response = await fetch(source);
if (!response.ok) throw new Error(`GET ${source} returned ${response.status}`);
const spec = (await response.json()) as JsonObject;

const info = spec.info;
if (isObject(info) && typeof info.description === "string") {
  info.description = info.description
    .split("\n\n")
    .filter((paragraph) => !paragraph.includes("without an API key"))
    .join("\n\n");
}

const paths = isObject(spec.paths) ? spec.paths : {};
for (const item of Object.values(paths)) {
  if (!isObject(item)) continue;
  for (const operation of Object.values(item)) {
    if (!isObject(operation)) continue;
    if (typeof operation.description === "string") {
      operation.description = operation.description.replace(KEYLESS_SENTENCE, "");
    }
    if (typeof operation.summary === "string") {
      operation.summary = operation.summary.replace(KEYLESS_SENTENCE, "");
    }
    const security = keyedOnly(operation.security);
    if (security !== undefined) operation.security = security;
  }
}

await Bun.write(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${target.pathname} from ${source}`);
