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

// "Get X" becomes "You get X"; a noun phrase like "A seller's products" becomes "You get a seller's products".
function whatYouGet(summary: string): string {
  const text = summary.replace(/\.$/, "");
  if (/^Get /.test(text)) return sentence(`You get ${text.slice(4)}`);
  if (/^(A|An|The) /.test(text)) return sentence(`You get ${lowerFirst(text)}`);
  return sentence(text);
}

const IDENTITY_WORDS: Record<string, string> = {
  query: "a search term",
  queries: "search terms",
  location: "a location",
  hashtag: "a hashtag",
  subreddit: "a subreddit name",
  domain: "a domain",
  audioId: "a sound id",
  boardUrl: "a board link",
  advertiser: "an advertiser name",
  category: "a category",
  country: "a country",
  origin: "an origin airport",
  destination: "a destination airport",
  departDate: "a departure date",
  adId: "an ad id",
};

const article = (phrase: string) => `${/^[aeiou]/i.test(phrase) && !/^us(e|ing)/i.test(phrase) ? "an" : "a"} ${phrase}`;

// "channelUrl" and "channelId" become "a channel link or id"; "userUrl" and "username" become "a user link or username".
function thingYouHave(fields: string[]): string {
  const kinds: Record<string, string> = { Url: "link", Id: "id", Code: "code" };
  const names: string[] = [];
  const forms: string[] = [];
  for (const field of fields) {
    const suffix = field.match(/(Url|Id|Code)$/)?.[1];
    const name = suffix === undefined ? field.replace(/name$/, "") : field.slice(0, -suffix.length);
    if (!names.includes(name)) names.push(name);
    const form = suffix === undefined ? field : kinds[suffix];
    if (form !== undefined && !forms.includes(form)) forms.push(form);
  }
  return article(`${list(names, "or")} ${list(forms, "or")}`);
}

function whenToUse(op: CatalogEndpoint): string {
  const best = op.bestWhen ?? "";
  const first = best.split(/(?<=\.)\s/)[0] ?? "";
  if (/^Best for /.test(first)) return sentence(`Use it for ${first.slice(9).replace(/\.$/, "")}`);
  if (/^Best when /.test(first)) return sentence(`Use it when ${first.slice(10).replace(/\.$/, "")}`);
  if (/^When /.test(first)) return sentence(`Use it when ${first.slice(5).replace(/\.$/, "")}`);
  const one = sendOne(op);
  if (one.length > 0) return `Use it when you have ${thingYouHave(one)}.`;
  const needs = required(op);
  if (needs.length > 0) return `Use it when you have ${list(needs.map((name) => IDENTITY_WORDS[name] ?? `a ${name}`), "and")}.`;
  return "Use it with no input, or narrow it with the options below.";
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
  const send = others.length === 0 ? undefined : `Send ${list(others.map(code), "and")}.`;
  const choose =
    one.length === 0
      ? undefined
      : one.length === 2
        ? `${send === undefined ? "Send" : "Also send"} ${code(one[0] ?? "")} or ${code(one[1] ?? "")}, not both.`
        : `${send === undefined ? "Send" : "Also send"} one of ${list(one.map(code), "or")}.`;
  if (send === undefined && choose === undefined) return "Nothing is required. Every input is optional.";
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
    const kindNote = name === "type" && kinds.length > 0 ? `What the row is: ${list(kinds.map(code), "or")}.` : undefined;
    const note = (own[name] === "" ? fromSchema[name] : own[name]) ?? kindNote ?? fromSchema[name] ?? config.fields[name];
    if (note !== undefined) picked.push([name, backtickNames(note)]);
  }
  return picked;
}

function responseSection(input: PageInput): string[] {
  const { endpoint, config, response } = input;
  const holds = config.holds[endpoint.id];
  if (holds === undefined) throw new Error(`No "holds" sentence for ${endpoint.id} in reference.config.json`);
  const lead = response.live ? "Here is a real response" : "Here is a sample response";
  const envelope = { success: true, data: response.data, creditsUsed: response.creditsUsed, requestId: REQUEST_ID };
  const notes = fieldNotes(input);
  const extra = bestWhenNotes(endpoint, config);
  return [
    "## Response",
    "",
    `${holds} ${lead}, shortened: lists show one row and long text is cut.`,
    "",
    "```json",
    showJson(envelope),
    "```",
    ...(notes.length === 0 ? [] : ["", "Fields to know:", "", ...notes.map(([name, note]) => `- ${code(name)}: ${sentence(linkIds(note, input))}`)]),
    ...(extra.length === 0 ? [] : ["", linkIds(extra.join(" "), input)]),
  ];
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
    fallback === undefined || (Array.isArray(fallback) && fallback.length === 0) ? "" : ` Default ${code(String(fallback))}.`;
  const choices = (values: Json[]) =>
    values.length > MAX_ENUM_SHOWN
      ? `One of ${values.length} values, like ${list(values.slice(0, 3).map((value) => code(String(value))), "and")}.`
      : `${list(values.map((value) => code(String(value))), "or")}.`;
  const consts = Array.isArray(schema.anyOf) ? schema.anyOf.filter(isObject).flatMap((part) => (part.const === undefined ? [] : [part.const])) : [];
  if (consts.length > 0) return `${choices(consts)}${defaultText}`;
  if (Array.isArray(schema.enum)) return `${choices(schema.enum)}${defaultText}`;
  const range = (min: Json | undefined, max: Json | undefined, unit: string) => {
    const low = typeof min === "number" ? min : undefined;
    const high = typeof max === "number" && !tooBig(max) ? max : undefined;
    if (low !== undefined && high !== undefined) return `${unit}, ${low} to ${high}.`;
    if (low !== undefined) return `${unit}, ${low} or more.`;
    if (high !== undefined) return `${unit}, up to ${high}.`;
    return `${unit}.`;
  };
  if (schema.type === "boolean") return `${code("true")} or ${code("false")}.${defaultText}`;
  if (schema.type === "integer") return `${range(schema.minimum, schema.maximum, "Whole number")}${defaultText}`;
  if (schema.type === "number") return `${range(schema.minimum, schema.maximum, "Number")}${defaultText}`;
  if (schema.type === "array") {
    const items = isObject(schema.items) ? schema.items : {};
    const most = typeof schema.maxItems === "number" ? `, up to ${schema.maxItems}` : "";
    if (Array.isArray(items.enum)) return `List of ${choices(items.enum).replace(/\.$/, "")}${most}.`;
    return `List of ${items.type === "integer" ? "whole numbers" : "text"}${most}.`;
  }
  if (schema.format === "date") return `Date, ${code("YYYY-MM-DD")}.`;
  if (typeof schema.pattern === "string" && /^\^\[A-Za-z\]\{2\}\$$/.test(schema.pattern)) return `Two letters.${defaultText}`;
  return `Text.${defaultText}`;
}

function optionsSection(input: PageInput): string[] {
  const { endpoint, config } = input;
  const chosen = new Set([...required(endpoint), ...sendOne(endpoint)]);
  const rows = Object.entries(properties(endpoint.input))
    .filter(([name]) => !chosen.has(name))
    .flatMap(([name, schema]) =>
      isObject(schema)
        ? [`| ${code(name)} | ${linkIds(optionText(endpoint, name, schema, config), input)} | ${optionValues(endpoint, name, schema, config)} |`]
        : [],
    );
  if (rows.length === 0) return [];
  return ["## Options", "", "| Option | What it does | Values |", "| --- | --- | --- |", ...rows, ...(config.notes[endpoint.id] === undefined ? [] : ["", linkIds(config.notes[endpoint.id] ?? "", input)])];
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
    const life = hours === undefined ? "" : ` A cursor lasts ${plural(hours, "hour")}. After that, start again from the first page.`;
    return `Send the ${code("cursor")} from the response to get the next page, until a response has none.${life}`;
  }
  const page = props.page;
  if (isObject(page)) {
    const last = typeof page.maximum === "number" ? ` Page numbers go up to ${page.maximum}.` : "";
    return `Send ${code("page: 2")}, then ${code("3")} and on, until ${code("data.results")} is empty.${last}`;
  }
  return "None. One call returns everything for the input.";
}

function costSection(input: PageInput): string[] {
  const { endpoint, creditsMax } = input;
  const price = endpoint.pricing ?? `${plural(endpoint.credits ?? 1, "credit")} per call`;
  const most = endpoint.pricing === null || endpoint.pricing === undefined || creditsMax === undefined ? "" : ` A call costs ${plural(creditsMax, "credit")} at most.`;
  const limit = "limit" in properties(endpoint.input) ? ` Send ${code("limit")} to get fewer results and pay for fewer.` : "";
  return [
    "## Cost and limits",
    "",
    `- **Price:** ${price}.${most} Failed calls and empty results cost nothing.${limit}`,
    `- **Paging:** ${pagingText(input)}`,
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

const asVerb = (summary: string) => {
  const text = summary.replace(/\.$/, "");
  if (/^(A|An|The) /.test(text)) return `get ${lowerFirst(text)}`;
  return lowerFirst(text);
};

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
    if (text !== undefined) return `- ${link}: ${text}`;
    const sends = derived.find(([other]) => other === id)?.[1].sends ?? required(target).filter((name) => !sendOne(target).includes(name));
    const lead = sends.length === 0 ? "Use it" : `Send ${list(sends.map(code), "and")}`;
    return `- ${link}: ${lead} to ${asVerb(target.summary)}.`;
  });
  return lines.length === 0 ? [] : ["## Next", "", ...lines];
}

// --- the page ---------------------------------------------------------------------

export function opening(op: CatalogEndpoint): string {
  return `${whatYouGet(op.summary)} ${whenToUse(op)}`;
}

export function requestIntro(op: CatalogEndpoint, config: TextConfig): string {
  const keyless = op.keyless === true ? " This endpoint works without an API key, within free limits." : "";
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
