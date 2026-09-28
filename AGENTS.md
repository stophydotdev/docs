# Stophy docs

Mintlify site for docs.stophy.dev. Pages are MDX with YAML frontmatter. Configuration lives in `docs.json`.

## Commands

- `mint dev` runs the site at http://localhost:3000.
- `mint validate` and `mint broken-links` must pass before a PR.

## API reference

Generated from https://api.stophy.dev/openapi.json (the `openapi` field of the "API reference" tab). Don't hand-write endpoint pages. To change an endpoint's docs, change the API's spec. After an API change, redeploy the docs from the Mintlify dashboard.

## Writing

- Plain words, short sentences, second person. Say what the reader gets.
- Every fact must match the live API (`GET https://api.stophy.dev/v1/endpoints`, `/openapi.json`) or the server code.
- Don't describe how Stophy gets its data or what runs it.
- Examples use curl, TypeScript `fetch` and Python `httpx`.
- Sentence case for headings.

Merging to `main` publishes the site.
