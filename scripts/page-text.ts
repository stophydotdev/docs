// The words on an endpoint page, built from the catalog entry, the response
// schema, an example response and the wording in reference.config.json.
// gen-reference.ts calls `body` once per endpoint and writes the result.

import { type CatalogEndpoint, type Json, type JsonObject, isObject } from "./catalog";

export interface TextConfig {
  notes: Record<string, string>;
  holds: Record<string, string>;
  bestWhenNotes: Record<string, string>;
  requests: Record<string, string>;
  cursorHours: Record<string, number>;
  pagingNotes: Record<string, string>;
  fields: Record<string, string>;
  fieldsFor: Record<string, Record<string, string>>;
  optionText: Record<string, string>;
  optionRewrites: Record<string, string>;
  optionValues: Record<string, string>;
  next: Record<string, (string | [string, string])[]>;
}

export interface ExampleResponse {
  live: boolean;
  creditsUsed: number;
  data: JsonObject;
}

export interface PageInput {
  endpoint: CatalogEndpoint;
  catalog: CatalogEndpoint[];
  config: TextConfig;
  schema: JsonObject | undefined;
  creditsMax: number | undefined;
  response: ExampleResponse;
  slug: (id: string) => string;
  label: (id: string) => string;
  titleOf: (id: string) => string;
}

// Gaps found while building pages. gen-reference.ts reports them all at once.
export const problems: string[] = [];

const REQUEST_ID = "2fe9dbad-fc48-4890-9751-0b24b596035b";
const MAX_ENUM_SHOWN = 10;
const MAX_FIELD_NOTES = 6;
const MAX_NEXT = 4;

const code = (text: string) => `\`${text}\``;
const list = (items: string[], last: string) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
const properties = (schema: Json | undefined): JsonObject =>
  isObject(schema) && isObject(schema.properties) ? schema.properties : {};

const required = (op: CatalogEndpoint): string[] => (Array.isArray(op.input?.required) ? (op.input.required as string[]) : []);
const sendOne = (op: CatalogEndpoint): string[] => {
  const one = (op.input as { sendOne?: string[] } | undefined)?.sendOne;
  return Array.isArray(one) ? one : [];
};

// "youtube.video" in a sentence becomes a link to that endpoint's page.
function linkIds(text: string, input: PageInput): string {
  const ids = input.catalog.map((item) => item.id).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(?<![\\w.\\[])(${ids.map((id) => id.replaceAll(".", "\\.")).join("|")})(?![\\w])`, "g");
  return text.replace(pattern, (id) => `[${input.label(id)}](/api-reference/endpoint/${input.slug(id)})`);
}

// --- opening ---------------------------------------------------------------

// Summaries are imperative ("Get X", "Search Y"). Reference text states what the method does.
const THIRD_PERSON: Record<string, string> = {
  Get: "Returns",
  Search: "Searches",
  Find: "Finds",
  Ask: "Sends a question to",
  Compare: "Compares",
  Read: "Returns",
  See: "Returns",
  List: "Lists",
  Pull: "Extracts",
};

function thirdPerson(summary: string): string {
  const text = summary.replace(/\.$/, "");
  const [first = "", ...rest] = text.split(" ");
  const verb = THIRD_PERSON[first];
  const likened = (line: string) => line.replace(/, like (its|the|Reddit's) /, ", equivalent to $1 ").replace(/, like /, ", such as ");
  if (verb !== undefined) return likened([verb, ...rest].join(" ")).replace(/^Sends a question to Google AI Mode a question and get/, "Sends a question to Google AI Mode and returns");
  if (/^(A|An|The) /.test(text)) return `Returns ${lowerFirst(text)}`;
  return text;
}

function whatYouGet(summary: string): string {
  return sentence(thirdPerson(summary));
}

function whenToUse(op: CatalogEndpoint): string {
  const one = sendOne(op);
  if (one.length === 0) return "";
  const kinds: Record<string, string> = { Url: "URL", Id: "ID", Code: "code" };
  const first = one[0] ?? "";
  const suffix = first.match(/(Url|Id|Code)$/)?.[1];
  const thing = suffix === undefined ? first.replace(/name$/, "") : first.slice(0, -suffix.length);
  const forms = one.map((field) => kinds[field.match(/(Url|Id|Code)$/)?.[1] ?? ""] ?? field);
  return `The ${thing} is identified by its ${list(forms, "or")}.`;
}

// Sentences of bestWhen that are facts about the endpoint, not advice on when to use it.
function bestWhenNotes(op: CatalogEndpoint, config: TextConfig): string[] {
  const reworded = config.bestWhenNotes[op.id];
  if (reworded !== undefined) return reworded === "" ? [] : [reworded];
  const sentences = (op.bestWhen ?? "").split(/(?<=\.)\s/).filter(Boolean);
  const advice = /^(Best for|Best when|When )/.test(sentences[0] ?? "");
  const rest = advice ? sentences.slice(1) : sentences;
  return rest.filter((text) => !/^Costs /.test(text));
}

// --- request ---------------------------------------------------------------

function requestLine(op: CatalogEndpoint, config: TextConfig): string {
  const override = config.requests[op.id];
  if (override !== undefined) return override;
  const one = sendOne(op);
  const others = required(op).filter((name) => !one.includes(name));
  const send =
    others.length === 0 ? undefined : `${list(others.map(code), "and")} ${others.length === 1 ? "is" : "are"} required.`;
  const choose =
    one.length === 0
      ? undefined
      : `Exactly one of ${list(one.map(code), "or")} is required. A request that sets ${one.length === 2 ? "both" : "more than one"}, or none, fails with ${code("invalidRequest")}.`;
  if (send === undefined && choose === undefined) return "This method has no required parameters.";
  return [send, choose].filter((line) => line !== undefined).join(" ");
}

// JSON with pretty-printed objects and short lists of plain values on one line.
function showJson(value: Json, indent = ""): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((item) => !isObject(item) && !Array.isArray(item))) return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    const inner = `${indent}  `;
    return `[\n${value.map((item) => `${inner}${showJson(item, inner)}`).join(",\n")}\n${indent}]`;
  }
  if (isObject(value)) {
    const inner = `${indent}  `;
    const entries = Object.entries(value).map(([key, item]) => `${inner}${JSON.stringify(key)}: ${showJson(item, inner)}`);
    return entries.length === 0 ? "{}" : `{\n${entries.join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

// --- response ---------------------------------------------------------------

function* walk(schema: Json | undefined): Generator<[string, JsonObject]> {
  if (!isObject(schema)) return;
  for (const [name, child] of Object.entries(properties(schema))) {
    if (isObject(child)) yield [name, child];
    yield* walk(child);
    if (isObject(child)) yield* walk(child.items);
  }
  for (const key of ["items", "oneOf", "anyOf", "allOf"]) {
    const value = schema[key];
    for (const part of Array.isArray(value) ? value : [value]) yield* walk(part);
  }
}

function schemaNotes(schema: JsonObject | undefined): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const [name, child] of walk(schema)) {
    if (typeof child.description === "string" && notes[name] === undefined) notes[name] = child.description;
  }
  return notes;
}

const FIRST_FIELDS = ["cursor", "repliesCursor", "type"];

// The values the `type` field can take on this endpoint's rows.
function rowKinds(schema: JsonObject | undefined): string[] {
  const kinds: string[] = [];
  for (const [name, child] of walk(schema)) {
    if (name !== "type") continue;
    const values = child.const !== undefined ? [child.const] : Array.isArray(child.enum) ? child.enum : [];
    for (const value of values) if (typeof value === "string" && !kinds.includes(value)) kinds.push(value);
  }
  return kinds;
}

function fieldNames(schema: JsonObject | undefined): Set<string> {
  return new Set([...walk(schema)].map(([name]) => name));
}

// Names the example actually shows, top level first, then the first row of each list.
function shownNames(data: JsonObject): string[] {
  const names: string[] = [];
  const add = (value: JsonObject) => names.push(...Object.keys(value).filter((name) => !names.includes(name)));
  add(data);
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) for (const row of value) if (isObject(row)) add(row);
    if (isObject(value)) add(value);
  }
  return names;
}

function fieldNotes(input: PageInput): [string, string][] {
  const { endpoint, config, response } = input;
  const own = config.fieldsFor[endpoint.id] ?? {};
  const fromSchema = schemaNotes(input.schema);
  const shown = new Set(shownNames(response.data));
  const important = [...FIRST_FIELDS, ...Object.keys(own), ...Object.keys(config.fields)];
  const kinds = rowKinds(input.schema);
  const picked: [string, string][] = [];
  for (const name of important) {
    if (picked.length === MAX_FIELD_NOTES) break;
    if (!shown.has(name) || picked.some(([done]) => done === name)) continue;
    const kindNote = name === "type" && kinds.length > 0 ? `The kind of item: ${list(kinds.map(code), "or")}.` : undefined;
    const note = (own[name] === "" ? fromSchema[name] : own[name]) ?? kindNote ?? fromSchema[name] ?? config.fields[name];
    if (note !== undefined) picked.push([name, backtickNames(note)]);
  }
  return picked;
}

function typeOf(schema: JsonObject | undefined, name: string, depth = 0): string | undefined {
  if (schema === undefined || depth > 8) return undefined;
  const props = isObject(schema.properties) ? schema.properties : undefined;
  if (props !== undefined) {
    const found = props[name];
    if (isObject(found)) return typeLabel(found);
    for (const child of Object.values(props)) {
      const inner = isObject(child) ? typeOf(child, name, depth + 1) : undefined;
      if (inner !== undefined) return inner;
    }
  }
  for (const key of ["items", "anyOf", "oneOf"]) {
    const part = schema[key];
    const parts = Array.isArray(part) ? part : [part];
    for (const child of parts) {
      const inner = isObject(child) ? typeOf(child, name, depth + 1) : undefined;
      if (inner !== undefined) return inner;
    }
  }
  return undefined;
}

function typeLabel(schema: JsonObject): string {
  const variants = Array.isArray(schema.anyOf) ? schema.anyOf.filter(isObject).filter((part) => part.type !== "null") : [];
  const own = variants.length === 1 ? (variants[0] ?? schema) : schema;
  if (variants.length > 1 && variants.every((part) => typeof part.const === "number")) return "integer";
  const raw = Array.isArray(own.type) ? own.type.find((item) => item !== "null") : own.type;
  if (raw === "array") {
    const items = isObject(own.items) ? own.items : {};
    return items.type === "object" || Array.isArray(items.anyOf) ? "object[]" : `${typeof items.type === "string" ? items.type : "string"}[]`;
  }
  if (own.format === "date-time") return "string (ISO 8601)";
  if (own.format === "date") return "string (date)";
  if (own.format === "uri") return "string (URL)";
  return typeof raw === "string" ? raw : "object";
}

function responseSection(input: PageInput): string[] {
  const { endpoint, config, response } = input;
  const holds = config.holds[endpoint.id];
  if (holds === undefined) throw new Error(`No "holds" sentence for ${endpoint.id} in reference.config.json`);
  const contains = formal(holds).replace(/^`data\.results` lists /, "`data.results[]` contains ").replace(/^`data` has /, "`data` contains ").replace(/^`data` names /, "`data` contains ");
  const lead = response.live
    ? "The following example is a real response, truncated: each list shows one item and long strings are cut."
    : "The following example is illustrative.";
  const envelope = { success: true, data: response.data, creditsUsed: response.creditsUsed, requestId: REQUEST_ID };
  const notes = fieldNotes(input);
  const extra = bestWhenNotes(endpoint, config);
  return [
    "## Response",
    "",
    `If successful, the response body contains the standard envelope. ${contains}`,
    "",
    lead,
    "",
    "```json",
    showJson(envelope),
    "```",
    ...(notes.length === 0
      ? []
      : [
          "",
          "| Field | Type | Description |",
          "| --- | --- | --- |",
          ...notes.map(([name, note]) => `| ${code(name)} | ${typeOf(input.schema, name) ?? "string"} | ${sentence(linkIds(formal(note), input))} |`),
          "",
          "For every field, see the response schema on this page.",
        ]),
    ...(extra.length === 0 ? [] : ["", `<Note>${linkIds(extra.join(" "), input)}</Note>`]),
  ];
}

// Rewrites plain descriptions into reference wording: what a field holds, what a parameter does.
const FORMAL: [RegExp, string][] = [
  [/^Only (.+)$/, "Restricts results to $1"],
  [/^Which (.+) to (.+)$/, "Specifies which $1 to $2"],
  [/^How to order (.+)$/, "Specifies the order of $1"],
  [/^How many (.+)$/, "The number of $1"],
  [/^How much (.+)$/, "The amount $1"],
  [/^How far back to look/, "Specifies the time range"],
  [/^How far from the location to look, in miles/, "The search radius around `location`, in miles"],
  [/^What to search for/, "Specifies the kind of result to search for"],
  [/^What to put first/, "Specifies how results are ranked"],
  [/^Whether (.+)$/, "Indicates whether $1"],
  [/^True when (.+)$/, "`true` if $1"],
  [/^True for (.+)$/, "`true` for $1"],
  [/^When it was (\w+), as a UTC time\.?$/, "The time it was $1, in UTC"],
  [/^Who (.+)$/, "The entity that $1"],
  [/^Where the searches were made/, "Specifies the Google property the searches were made on"],
  [/^Where the result sits in the list, starting at 1/, "The 1-based position of the result in the list"],
  [/^Lowest (.+)$/, "The minimum $1"],
  [/^Highest (.+)$/, "The maximum $1"],
  [/^Fewest (.+)$/, "The minimum number of $1"],
  [/^Most (.+)$/, "The maximum number of $1"],
  [/^Smallest (.+)$/, "The minimum $1"],
  [/^Largest (.+)$/, "The maximum $1"],
  [/^Send it back as (`\w+`) to get the next page\. The last page has none\.$/, "The pagination token. Pass it as $1 to retrieve the next page. Omitted on the last page"],
  [/^Send it as (`\w+`) to get (.+)$/, "A token. Pass it as $1 to retrieve $2"],
  [/^Page number, starting at 1\.$/, "The page to return. Pages are numbered from 1"],
  [/^The `cursor` from the previous response\. Send it back unchanged\.$/, "The pagination token from the previous response"],
  [/^Two-letter country code, like `us`\.$/, "The country to query, as a two-letter ISO 3166-1 code such as `us`"],
  [/^Two-letter country code, or `all`\.$/, "The country to query, as a two-letter ISO 3166-1 code, or `all`"],
  [/^Two-letter language code, like `en` or `pt`\.$/, "The language of the results, as a two-letter ISO 639-1 code such as `en`"],
  [/^Language code, like `en` or `pt-BR`\.$/, "The language of the results, as a BCP 47 tag such as `en` or `pt-BR`"],
];

// Wording fixes that apply anywhere in a sentence.
const NEUTRAL: [RegExp, string][] = [
  [/, like /g, ", such as "],
  [/ like (`|\[|")/g, " such as $1"],
  [/\bSend it back as (`\w+`) to get /g, "Pass it as $1 to retrieve "],
  [/\bSend one back as /g, "Pass one as "],
  [/\bSend as (`\w+`) to /g, "Pass it as $1 to "],
  [/\bSend it with (`\w+`)\./g, "Requires $1."],
  [/\bSend (`\w+`) or (`\w+`), not both\./g, "Mutually exclusive: set either $1 or $2."],
  [/\bLeft out when\b/g, "Omitted when"],
  [/ you can cancel for free/g, " that offer free cancellation"],
  [/ that match your query/g, " that match the query"],
  [/Choices you already picked are applied\. Sending a chosen one again removes it\./g, "Previously selected filters remain applied. Passing a selected filter again removes it."],
  [/ when you send (`\w+`)/g, " when $1 is set"],
  [/ you picked| you asked for/g, " requested"],
  [/^How finely to split the results by place/, "Specifies the granularity of the regional breakdown"],
  [/^How recent the ads are/, "Restricts results by recency"],
  [/^How popular the related search is\. 100 is the most popular/, "The relative popularity of the related search. The maximum is 100"],
  [/^Which (\w+) come first/, "Specifies which $1 are returned first"],
  [/^Which date (`\w+`) and (`\w+`) compare to/, "Specifies the date that $1 and $2 are compared against"],
  [/ Text, or a list of 1 to 5\./g, " Accepts a string or an array of 1 to 5 strings."],
  [/^Return at most this many ([\w ]+)\. You pay (.+) returned\.?$/, "The maximum number of $1 to return. Billed at $2 returned"],
  [/^Approximate: /, "Approximate. "],
];

function formal(text: string): string {
  const rule = FORMAL.find(([pattern]) => pattern.test(text));
  const shaped = rule === undefined ? text : text.replace(rule[0], rule[1]);
  return NEUTRAL.reduce((line, [pattern, to]) => line.replace(pattern, to), shaped);
}

// --- options -----------------------------------------------------------------

const GENERIC_TEXT: [RegExp, string][] = [
  [/^ISO 3166-1 alpha-2 country code, e\.g\. us\. Any case is accepted\.$/, "Two-letter country code, like `us`."],
  [/^ISO 3166-1 alpha-2 country code, or all\. Any case is accepted\.$/, "Two-letter country code, or `all`."],
  [/^Two-letter language code like en or pt\. Any case is accepted\.$/, "Two-letter language code, like `en` or `pt`."],
  [/^BCP 47 language tag, e\.g\. en or pt-BR\. Any case is accepted\.$/, "Language code, like `en` or `pt-BR`."],
  [/^The cursor from the previous response\. Send it as is\.$/, "The `cursor` from the previous response. Send it back unchanged."],
  [/^Page number, starting at 1\.$/, "Page number, starting at 1."],
];

// "citesId" in a sentence becomes `citesId`.
const backtickNames = (text: string) => text.replace(/(?<![`\w])([a-z]+[A-Z]\w*)(?![`\w])/g, "`$1`");

function optionText(op: CatalogEndpoint, name: string, schema: JsonObject, config: TextConfig): string {
  const override = config.optionText[`${op.id}.${name}`];
  if (override !== undefined) return override;
  const given = typeof schema.description === "string" ? schema.description : undefined;
  if (given === undefined) {
    const shared = config.optionText[name];
    if (shared === undefined) problems.push(`No text for option ${name} of ${op.id} in reference.config.json`);
    return shared ?? "";
  }
  const rewritten = config.optionRewrites[given];
  if (rewritten !== undefined) return rewritten;
  const generic = GENERIC_TEXT.find(([pattern]) => pattern.test(given));
  if (generic !== undefined) return generic[1];
  const plain = given.replace(/ Any case is accepted\.$/, "");
  return sentence(backtickNames(plain));
}

const tooBig = (value: number) => Math.abs(value) > 1e9;

function optionValues(op: CatalogEndpoint, name: string, schema: JsonObject, config: TextConfig): string {
  const custom = config.optionValues[`${op.id}.${name}`] ?? config.optionValues[name];
  if (custom !== undefined) return custom;
  const fallback = schema.default;
  const defaultText =
    fallback === undefined || (Array.isArray(fallback) && fallback.length === 0) ? "" : ` If unset, defaults to ${code(String(fallback))}.`;
  const choices = (values: Json[]) =>
    values.length > MAX_ENUM_SHOWN
      ? `Accepts one of ${values.length} values, such as ${list(values.slice(0, 3).map((value) => code(String(value))), "and")}.`
      : `Acceptable values are ${list(values.map((value) => code(String(value))), "and")}.`;
  const consts = Array.isArray(schema.anyOf) ? schema.anyOf.filter(isObject).flatMap((part) => (part.const === undefined ? [] : [part.const])) : [];
  if (consts.length > 0) return `${choices(consts)}${defaultText}`;
  if (Array.isArray(schema.enum)) return `${choices(schema.enum)}${defaultText}`;
  const range = (min: Json | undefined, max: Json | undefined, unit: string) => {
    const low = typeof min === "number" ? min : undefined;
    const high = typeof max === "number" && !tooBig(max) ? max : undefined;
    if (low !== undefined && high !== undefined) return `Must be between ${low} and ${high}.`;
    if (low !== undefined) return low === 0 ? "" : `The minimum is ${low}.`;
    if (high !== undefined) return `The maximum is ${high}.`;
    return unit === "" ? "" : "";
  };
  if (schema.type === "boolean") return defaultText.trim();
  if (schema.type === "integer") return `${range(schema.minimum, schema.maximum, "")}${defaultText}`.trim();
  if (schema.type === "number") return `${range(schema.minimum, schema.maximum, "")}${defaultText}`.trim();
  if (schema.type === "array") {
    const items = isObject(schema.items) ? schema.items : {};
    const most = typeof schema.maxItems === "number" ? `, up to ${schema.maxItems}` : "";
    const cap = typeof schema.maxItems === "number" ? ` Accepts up to ${schema.maxItems} values.` : "";
    if (Array.isArray(items.enum)) return `${choices(items.enum)}${cap}`;
    return cap.trim();
  }
  if (schema.format === "date") return `Format: ${code("YYYY-MM-DD")}.`;
  return defaultText.trim();
}

function optionsSection(input: PageInput): string[] {
  const { endpoint, config } = input;
  const chosen = new Set([...required(endpoint), ...sendOne(endpoint)]);
  const rows = Object.entries(properties(endpoint.input))
    .filter(([name]) => !chosen.has(name))
    .flatMap(([name, schema]) => {
      if (!isObject(schema)) return [];
      const text = sentence(formal(linkIds(optionText(endpoint, name, schema, config), input)).replace(/\.$/, ""));
      const values = optionValues(endpoint, name, schema, config);
      return [`| ${code(name)} | ${typeLabel(schema)} | ${[text, values].filter((part) => part !== "").join(" ")} |`];
    });
  if (rows.length === 0) return [];
  return [
    "## Optional parameters",
    "",
    "| Parameter | Type | Description |",
    "| --- | --- | --- |",
    ...rows,
    ...(config.notes[endpoint.id] === undefined ? [] : ["", `<Note>${linkIds(config.notes[endpoint.id] ?? "", input)}</Note>`]),
  ];
}

// --- cost and limits ------------------------------------------------------------

function pagingText(input: PageInput): string {
  const note = input.config.pagingNotes[input.endpoint.id];
  return `${pagingRule(input)}${note === undefined ? "" : ` ${note}`}`;
}

function pagingRule(input: PageInput): string {
  const { endpoint, config } = input;
  const props = properties(endpoint.input);
  if ("cursor" in props) {
    const hours = config.cursorHours[endpoint.id];
    const life = hours === undefined ? "" : ` A cursor expires ${plural(hours, "hour")} after it is issued.`;
    return `Results are paginated. To retrieve the next page, pass the value of ${code("data.cursor")} as ${code("cursor")} in a subsequent request. A response that omits ${code("cursor")} is the last page.${life}`;
  }
  const page = props.page;
  if (isObject(page)) {
    const last = typeof page.maximum === "number" ? ` The maximum value of ${code("page")} is ${page.maximum}.` : "";
    return `Results are paginated. To retrieve the next page, increment ${code("page")}. An empty ${code("data.results")} indicates the last page.${last}`;
  }
  return "This method is not paginated. A single request returns the complete result.";
}

function costSection(input: PageInput): string[] {
  const { endpoint, creditsMax } = input;
  const flat = endpoint.pricing === null || endpoint.pricing === undefined;
  const price = flat
    ? `Each successful request consumes ${plural(endpoint.credits ?? 1, "credit")}, regardless of the number of items returned.`
    : `A successful request consumes ${endpoint.pricing}${creditsMax === undefined ? "" : `, up to ${plural(creditsMax, "credit")}`}.`;
  const limit = "limit" in properties(endpoint.input) ? ` Set ${code("limit")} to cap the number of items returned and billed.` : "";
  return [
    "## Billing",
    "",
    `${price} Requests that fail, or that return no items, are not billed.${limit}`,
    "",
    "## Pagination",
    "",
    pagingText(input),
  ];
}

// --- next ----------------------------------------------------------------------

const ALIASES: Record<string, string[]> = {
  username: ["username", "authorUsername"],
  userUrl: ["userUrl", "authorUrl"],
  subreddit: ["subreddit", "subredditName"],
};

const identityInput = (name: string) => /(Url|Id|Code)$/.test(name) || name in ALIASES;

interface Link {
  id: string;
  sends: string[];
}

function derivedLinks(input: PageInput): Link[] {
  const { endpoint, catalog } = input;
  const returned = fieldNames(input.schema);
  const family = endpoint.id.split(".")[0];
  const pair = endpoint.id.split(".").slice(0, 2).join(".");
  const narrowFamily = /\.(ads|shop)\./.test(endpoint.id);
  const links: (Link & { score: number })[] = [];
  for (const other of catalog) {
    if (other.id === endpoint.id || other.id.split(".")[0] !== family) continue;
    if (narrowFamily && other.id.split(".").slice(0, 2).join(".") !== pair) continue;
    const identities = [...new Set([...sendOne(other), ...required(other)])].filter(identityInput);
    const sends = identities.filter((name) => (ALIASES[name] ?? [name]).some((alias) => returned.has(alias)));
    if (sends.length === 0) continue;
    const exact = sends.filter((name) => returned.has(name));
    const score = (exact.length > 0 ? 2 : 1) + (other.id.startsWith(endpoint.id.split(".").slice(0, 2).join(".")) ? 1 : 0);
    const also = required(other).filter((name) => !identities.includes(name) && !sendOne(other).includes(name));
    links.push({ id: other.id, sends: [exact[0] ?? sends[0] ?? "", ...also], score });
  }
  return links.sort((a, b) => b.score - a.score).map(({ id, sends }) => ({ id, sends }));
}

// A forced link is an id, or [id, text] when the line needs its own words.
function nextSection(input: PageInput): string[] {
  const { endpoint, catalog, config } = input;
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const forced = (config.next[endpoint.id] ?? []).map((entry) => (typeof entry === "string" ? ([entry, undefined] as const) : entry));
  const derived = derivedLinks(input).map((link) => [link.id, link] as const);
  const entries = [...forced.map(([id, text]) => [id, text] as const), ...derived.map(([id]) => [id, undefined] as const)]
    .filter(([id], index, all) => all.findIndex(([other]) => other === id) === index)
    .slice(0, MAX_NEXT);
  const lines = entries.map(([id, text]) => {
    const target = byId.get(id);
    if (target === undefined) throw new Error(`Next link ${id} for ${endpoint.id} is not an endpoint`);
    const link = `[${input.label(id)}](/api-reference/endpoint/${input.slug(id)})`;
    const does = sentence(thirdPerson(target.summary));
    if (text !== undefined) {
      const accepts = text.match(/^Send (.+?) to /)?.[1];
      return accepts === undefined ? `- ${link}: ${text}` : `- ${link}: Accepts ${accepts}. ${does}`;
    }
    const sends = derived.find(([other]) => other === id)?.[1].sends ?? required(target).filter((name) => !sendOne(target).includes(name));
    return sends.length === 0 ? `- ${link}: ${does}` : `- ${link}: Accepts ${list(sends.map(code), "and")}. ${does}`;
  });
  return lines.length === 0 ? [] : ["## Related methods", "", ...lines];
}

// --- the page ---------------------------------------------------------------------

export function opening(op: CatalogEndpoint): string {
  return [whatYouGet(op.summary), whenToUse(op)].filter((part) => part !== "").join(" ");
}

export function requestIntro(op: CatalogEndpoint, config: TextConfig): string {
  const keyless =
    op.keyless === true
      ? "\n\n<Note>This endpoint can be called without an API key, subject to per-address limits. Pagination requires a key.</Note>"
      : "";
  return `${requestLine(op, config)}${keyless}`;
}

export function body(input: PageInput, example: string[]): string[] {
  const { endpoint, config } = input;
  const options = optionsSection(input);
  const next = nextSection(input);
  return [
    opening(endpoint),
    "",
    "## Request",
    "",
    requestIntro(endpoint, config),
    "",
    ...example,
    "",
    ...responseSection(input),
    ...(options.length === 0 ? [] : ["", ...options]),
    "",
    ...costSection(input),
    ...(next.length === 0 ? [] : ["", ...next]),
  ];
}
