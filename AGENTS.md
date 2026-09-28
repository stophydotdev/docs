# Stophy docs

Mintlify site for docs.stophy.dev. Pages are MDX with YAML frontmatter. Configuration lives in `docs.json`. Merging to `main` publishes.

## Layout

- Documentation tab: `introduction`, `quickstart`, `mcp-server` (overview) with `mcp-server/{keyless,oauth}`, `ai-onboarding`, `advanced-guide`, `billing`, `rate-limits`, the "What you can get" category pages `sources/*`, `guides/*`.
- API Reference tab: `api-reference/{introduction,errors,usage,logs}` (hand-written) and `api-reference/endpoint/*` (generated), grouped by category, then source.
- Build with AI tab: `ai-onboarding`, the MCP pages, `quickstarts/{claude-code,claude-desktop,cursor,codex}`, `developer-guides/llm-sdks/*`.
- SDKs tab: `sdks/{overview,typescript,python,cli}`.

## Generated files

`bun scripts/sync-openapi.ts` refreshes `api-reference/openapi.json` from the live API. `bun scripts/gen-reference.ts` writes `api-reference/endpoint/*.mdx`, the category pages `sources/*.mdx` and the matching navigation in `docs.json`. Every endpoint belongs to exactly one category in `areas`. Never hand-edit those files; edit `scripts/reference.config.json` and regenerate.

## Checks

`mint validate` and `mint broken-links` must pass. Load changed pages in `mint dev`.

## Writing

- Plain words, short sentences, second person. Say what the reader gets.
- Every fact must match the live API (`/v1/endpoints`, `/openapi.json`) or the server code. Every example request must be a real call; free endpoints are free to call.
- Don't describe how Stophy gets its data or what runs it.
- Examples use cURL, Node.js `fetch` and Python `requests`.
- Every page has `title`, a 120 to 160 character `description`, `og:title` as `<Title> | Stophy` and `og:description`. Use `sidebarTitle` when the title is longer than the sidebar label.
- Sentence case for headings.
