const source = process.env.STOPHY_OPENAPI_URL ?? "https://api.stophy.dev/openapi.json";
const target = new URL("../api-reference/openapi.json", import.meta.url);

const response = await fetch(source);
if (!response.ok) throw new Error(`GET ${source} returned ${response.status}`);
const spec: unknown = await response.json();
await Bun.write(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${target.pathname} from ${source}`);
