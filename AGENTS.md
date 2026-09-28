# Stophy docs

Mintlify site for docs.stophy.dev. Pages are MDX with YAML frontmatter. Configuration lives in `docs.json`. Merging to `main` publishes.

## Layout

- Documentation tab: `introduction`, `quickstart`, `mcp-server`, `without-a-key`, `advanced-guide`, `billing`, `rate-limits`, `sources/*`, `quickstarts/{curl,nodejs,python}`.
- SDKs tab: `sdks/*`.
- API Reference tab: `api-reference/{introduction,errors,usage,logs}` (hand-written) and `api-reference/endpoint/*` (generated).
- Build with AI tab: `ai-onboarding`, `quickstarts/{claude-code,cursor,codex}`, `developer-guides/llm-sdks/*`.

## Generated files

`bun scripts/sync-openapi.ts` refreshes `api-reference/openapi.json` from the live API. `bun scripts/gen-reference.ts` writes `api-reference/endpoint/*.mdx`, `sources/*.mdx` and the matching navigation in `docs.json`. Never hand-edit those files; edit `scripts/reference.config.json` and regenerate.

## Checks

`mint validate` and `mint broken-links` must pass. Load changed pages in `mint dev`.

## Writing

- Plain words, short sentences, second person. Say what the reader gets.
- Every fact must match the live API (`/v1/endpoints`, `/openapi.json`) or the server code. Every example request must be a real call; free endpoints are free to call.
- Don't describe how Stophy gets its data or what runs it.
- Examples use cURL, Node.js `fetch` and Python `httpx`. SDK snippets must run against the SDK source.
- Sentence case for headings.
