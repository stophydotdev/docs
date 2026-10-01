// Generates the call examples used across the Documentation tab, one snippet
// file per endpoint per language, from the live catalog's example input.
// Run with `bun scripts/gen-examples.ts`.
//
// Output: snippets/examples/<endpoint-id>/{ts,python,curl,cli}.mdx
// Every file it writes is overwritten on each run: the catalog is the source
// of truth, not these files. Import them into a page with, for example:
//   import Ts from '/snippets/examples/web.search/ts.mdx';
// and place the import inside a <CodeGroup>.

import { rm } from "node:fs/promises";
import { type CatalogEndpoint, type Json, type JsonObject, fetchCatalog, isObject } from "./catalog";

const root = new URL("..", import.meta.url);
const file = (path: string) => new URL(path, root);
const SNIPPETS_DIR = "snippets/examples";

// The catalog only ships an `example` for endpoints it can fill in on its own.
// A "get one item" endpoint needs a real id or URL that normally comes from a
// search result, so these are hand-picked, realistic values for the ones the
// catalog leaves out.
const FALLBACK_EXAMPLES: Record<string, JsonObject> = {
  "reddit.post": { post: "https://www.reddit.com/r/rust/comments/1c8x9k2/why_i_switched_to_rust/" },
  "maps.place": { place: "ChIJN1t_tDeuEmsRUsoyG83frY4" },
  "maps.reviews": { place: "ChIJN1t_tDeuEmsRUsoyG83frY4" },
  "instagram.post": { post: "https://www.instagram.com/p/C1a2B3cD4eF/" },
  "instagram.comments": { post: "https://www.instagram.com/p/C1a2B3cD4eF/" },
  "ads.ad": { network: "meta", ad: "1234567890123456" },
  "linkedin.jobs.job": { job: "https://www.linkedin.com/jobs/view/3812345678" },
  "zillow.property": { property: "https://www.zillow.com/homedetails/123-Main-St-New-York-NY-10001/12345678_zpid/" },
  "upwork.job": { job: "https://www.upwork.com/jobs/~0123456789abcdef01" },
  "airbnb.listing": { listing: "https://www.airbnb.com/rooms/12345678" },
  "airbnb.calendar": { listing: "https://www.airbnb.com/rooms/12345678" },
  "airbnb.reviews": { listing: "https://www.airbnb.com/rooms/12345678" },
  "rightmove.property": { property: "https://www.rightmove.co.uk/properties/123456789" },
  "immoscout.listing": { listing: "https://www.immobilienscout24.de/expose/123456789" },
  "pinterest.pin": { pin: "https://www.pinterest.com/pin/123456789012345678/" },
  "pinterest.board": { board: "https://www.pinterest.com/example/example-board/" },
};

// --- naming -----------------------------------------------------------

const toSnakeCase = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const pythonKey = (name: string) => (name === "from" ? "from_" : toSnakeCase(name));

// --- value rendering ----------------------------------------------------

function tsValue(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(tsValue).join(", ")}]`;
  if (isObject(value)) {
    const entries = Object.entries(value).map(([key, v]) => `${key}: ${tsValue(v)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return "null";
}

function tsObjectLiteral(input: JsonObject): string {
  const entries = Object.entries(input).map(([key, value]) => `${key}: ${tsValue(value)}`);
  return entries.length === 0 ? "{}" : `{ ${entries.join(", ")} }`;
}

function pythonValue(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(pythonValue).join(", ")}]`;
  if (isObject(value)) {
    const entries = Object.entries(value).map(([key, v]) => `${JSON.stringify(key)}: ${pythonValue(v)}`);
    return `{${entries.join(", ")}}`;
  }
  return "None";
}

function pythonKwargs(input: JsonObject): string {
  return Object.entries(input)
    .map(([key, value]) => `${pythonKey(key)}=${pythonValue(value)}`)
    .join(", ");
}

const cliQuote = (value: string): string => (/^[A-Za-z0-9._:/@,+-]+$/u.test(value) ? value : JSON.stringify(value));

function cliValue(value: Json): string | undefined {
  if (typeof value === "string") return cliQuote(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string | number => typeof item === "string" || typeof item === "number");
    return items.length === 0 ? undefined : items.map(String).join(",");
  }
  return undefined;
}

// --- schema helpers -------------------------------------------------------

/** The CLI's positional argument: the one required free-text field, else `query`. Choices such as `network` stay flags. */
function positionalField(op: CatalogEndpoint): string | undefined {
  const properties = (op.input?.properties as JsonObject | undefined) ?? {};
  const required = Array.isArray(op.input?.required) ? (op.input?.required as string[]) : [];
  const free = required.filter((name) => {
    const schema = properties[name];
    return isObject(schema) && schema.type === "string" && schema.enum === undefined;
  });
  if (free.length === 1) return free[0];
  if (free.length > 0) return undefined;
  const query = properties.query;
  return isObject(query) && query.type === "string" && query.enum === undefined ? "query" : undefined;
}

function dataProperties(op: CatalogEndpoint, spec: JsonObject): string[] {
  const paths = spec.paths as JsonObject | undefined;
  const item = paths?.[op.path];
  if (!isObject(item)) return [];
  const operation = item[op.method.toLowerCase()];
  if (!isObject(operation)) return [];
  const ok = ((operation.responses as JsonObject | undefined)?.["200"] as JsonObject | undefined)?.content as JsonObject | undefined;
  const envelope = (ok?.["application/json"] as JsonObject | undefined)?.schema as JsonObject | undefined;
  const data = (envelope?.properties as JsonObject | undefined)?.data as JsonObject | undefined;
  if (!isObject(data)) return [];
  const own = Object.keys((data.properties as JsonObject | undefined) ?? {});
  if (own.length > 0) return own.filter((field) => field !== "cursor");
  const options = (data.allOf ?? data.oneOf ?? data.anyOf) as Json[] | undefined;
  if (!Array.isArray(options)) return [];
  const [first] = options;
  return isObject(first) ? Object.keys((first.properties as JsonObject | undefined) ?? {}).filter((field) => field !== "cursor") : [];
}

// The first property in the response schema is usually the substance of the
// call (`results`, `profile`, `listings`...), but a few endpoints put an echo
// of the input first (`domain`, `query`) or a bare `id` ahead of the payload.
// These name the field that is actually worth printing in an example.
const PRIMARY_FIELD_OVERRIDES: Record<string, string> = {
  transcript: "text",
  "youtube.video": "title",
};

/** The field to read off `result.data` in the TS and Python snippets. */
function primaryField(op: CatalogEndpoint, spec: JsonObject): string | undefined {
  const override = PRIMARY_FIELD_OVERRIDES[op.id];
  if (override !== undefined) return override;
  return dataProperties(op, spec).includes("results") ? "results" : undefined;
}

// --- snippet bodies -----------------------------------------------------

function tsSnippet(op: CatalogEndpoint, spec: JsonObject): string {
  const field = primaryField(op, spec);
  const access = field === undefined ? "result.data" : `result.data.${field}`;
  return [
    '```typescript TypeScript icon="/images/icons/typescript.svg"',
    'import { Stophy } from "stophy";',
    "",
    "const stophy = new Stophy({ apiKey: process.env.STOPHY_API_KEY });",
    `const result = await stophy.${op.id}(${tsObjectLiteral(op.example ?? {})});`,
    `console.log(${access});`,
    "```",
    "",
  ].join("\n");
}

function pythonSnippet(op: CatalogEndpoint, spec: JsonObject): string {
  const field = primaryField(op, spec);
  const access = field === undefined ? 'result["data"]' : `result["data"]["${field}"]`;
  return [
    '```python Python icon="python"',
    "from stophy import Stophy",
    "",
    "stophy = Stophy()  # reads STOPHY_API_KEY",
    `result = stophy.${op.id}(${pythonKwargs(op.example ?? {})})`,
    `print(${access})`,
    "```",
    "",
  ].join("\n");
}

function curlSnippet(op: CatalogEndpoint): string {
  const body = JSON.stringify(op.example ?? {});
  return [
    '```bash cURL icon="terminal"',
    `curl -X POST https://api.stophy.dev${op.path} \\`,
    '  -H "Authorization: Bearer $STOPHY_API_KEY" \\',
    '  -H "content-type: application/json" \\',
    `  -d '${body.replaceAll("'", "'\\''")}'`,
    "```",
    "",
  ].join("\n");
}

function cliSnippet(op: CatalogEndpoint): string {
  const words = op.id.split(".").join(" ");
  const example = op.example ?? {};
  const positional = positionalField(op);
  const pieces = [`stophy ${words}`];
  if (positional !== undefined) {
    const value = example[positional];
    if (typeof value === "string") pieces.push(cliQuote(value));
  }
  for (const [key, value] of Object.entries(example)) {
    if (key === positional || key === "cursor") continue;
    if (typeof value === "boolean") {
      pieces.push(value ? `--${key}` : `--no-${key}`);
      continue;
    }
    const rendered = cliValue(value);
    if (rendered !== undefined) pieces.push(`--${key}`, rendered);
  }
  return ['```bash CLI icon="square-terminal"', pieces.join(" "), "```", ""].join("\n");
}

// --- main -----------------------------------------------------------------

const rawCatalog = await fetchCatalog();
const spec = (await Bun.file(file("api-reference/openapi.json")).json()) as JsonObject;

const EXAMPLE_OVERRIDES: Record<string, JsonObject> = {
  transcript: { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
};

const catalog: CatalogEndpoint[] = rawCatalog.endpoints.map((op) => {
  const override = EXAMPLE_OVERRIDES[op.id];
  if (override !== undefined) return { ...op, example: override };
  return isObject(op.example) ? op : { ...op, example: FALLBACK_EXAMPLES[op.id] };
});

const missingExample = catalog.filter((op) => !isObject(op.example));
if (missingExample.length > 0) {
  throw new Error(`No example input, and no fallback, for: ${missingExample.map((op) => op.id).join(", ")}`);
}

await rm(file(`${SNIPPETS_DIR}/`), { recursive: true, force: true });

for (const op of catalog) {
  const base = `${SNIPPETS_DIR}/${op.id}`;
  await Bun.write(file(`${base}/ts.mdx`), tsSnippet(op, spec));
  await Bun.write(file(`${base}/python.mdx`), pythonSnippet(op, spec));
  await Bun.write(file(`${base}/curl.mdx`), curlSnippet(op));
  await Bun.write(file(`${base}/cli.mdx`), cliSnippet(op));
}

console.log(`Wrote ${catalog.length * 4} snippet files for ${catalog.length} endpoints.`);
