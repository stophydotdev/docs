# Stophy docs

The source for [docs.stophy.dev](https://docs.stophy.dev), built with [Mintlify](https://mintlify.com).

## Run locally

```bash
npm i -g mint
mint dev
```

Open http://localhost:3000.

Before you push, run:

```bash
mint validate
mint broken-links
```

## The API reference

The API reference tab is generated from the live spec at https://api.stophy.dev/openapi.json (set in `docs.json`). There is no file to sync. `mint dev` reads the live spec. The published site reads it when it builds, so after an API change, redeploy the docs from the Mintlify dashboard to pick up new endpoints.

## Publishing

Mintlify deploys `main`. Open a pull request; merging it publishes.
