# Stophy docs

The source for [docs.stophy.dev](https://docs.stophy.dev), built with [Mintlify](https://mintlify.com).

## Run locally

```bash
npm i -g mint
mint dev
```

Open http://localhost:3000. Before you open a pull request, run `mint validate` and `mint broken-links`.

## The API reference

The API reference, the Sources pages and the call examples are generated from the API's OpenAPI spec and live catalog:

```bash
bun scripts/sync-openapi.ts    # download https://api.stophy.dev/openapi.json into api-reference/openapi.json
bun scripts/gen-examples.ts    # write snippets/examples/<id>/*.mdx
bun scripts/gen-reference.ts   # write api-reference/endpoint/*.mdx and the API Reference navigation in docs.json
bun scripts/gen-sources.ts     # write sources/*.mdx
```

Run all four after the API changes, then commit the result. Each endpoint page also shows a short example response from `scripts/responses/<id>.json`. `STOPHY_CATALOG_URL=<catalog> STOPHY_LIVE_DIR=<folder of saved calls> bun scripts/gen-responses.ts` rebuilds them from saved calls, one `<id>.json` of `{ "input", "output" }` each. An endpoint with no saved call keeps a hand-written sample marked `"live": false`. `STOPHY_CATALOG_URL` can also be a path to a saved catalog file. `bun scripts/check-titles.ts` checks that the source names and endpoint titles in the config match the live catalog. Don't edit the generated files. To change what they say, edit `scripts/reference.config.json` (source names, endpoint titles, categories, and per-endpoint wording), `scripts/gen-sources.ts` (the Sources pages), `scripts/page-text.ts` (how each endpoint page is worded) or the API's spec.

## Publishing

Mintlify deploys `main`. Open a pull request; merging it publishes.
