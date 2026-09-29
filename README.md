# Stophy docs

The source for [docs.stophy.dev](https://docs.stophy.dev), built with [Mintlify](https://mintlify.com).

## Run locally

```bash
npm i -g mint
mint dev
```

Open http://localhost:3000. Before you open a pull request, run `mint validate` and `mint broken-links`.

## The API reference

The API reference and the Sources pages are generated from the API's OpenAPI spec:

```bash
bun scripts/sync-openapi.ts    # download https://api.stophy.dev/openapi.json into api-reference/openapi.json
bun scripts/gen-reference.ts   # write api-reference/endpoint/*.mdx, sources/*.mdx and their navigation in docs.json
```

Run both after the API changes, then commit the result. `bun scripts/check-titles.ts` checks that the source names and endpoint titles in the config match the live catalog. Don't edit the generated files. To change what they say, edit `scripts/reference.config.json` (source names, source pages, and per-endpoint notes) or the API's spec.

## Publishing

Mintlify deploys `main`. Open a pull request; merging it publishes.
