# Docs site

The VitePress documentation site for the @dusrel/image family,
live at https://dusmamud.github.io/dusrel-image/ (the playground
is assembled into it at `/playground/`).

```bash
pnpm --filter @dusrel/docs-site dev     # local dev server
pnpm --filter @dusrel/docs-site build   # TypeDoc API + static site + playground
```

How it fits together:

- **Reader guides** (`guide/quickstart.md`, `concepts.md`,
  `cookbook.md`, `frameworks.md`, `bundlers.md`) are written for
  the site — edit them here.
- **Reference pages** (architecture, codec guide, browser
  support, …) are thin wrappers that `@include` the single-source
  documents in the repo's `docs/` folder — edit those, never the
  wrappers.
- **API reference**: `build:api` runs TypeDoc over every
  public package's entry points and emits HTML into
  `public/api/` (generated, git-ignored), which VitePress
  copies into the built site at `/api/`.
- **Playground**: the build finishes with
  `scripts/assemble-playground.mjs`, which copies
  `apps/playground` plus the package builds it needs into the
  site output.
- The **Docs GitHub Actions workflow** builds the whole site on
  every docs change and deploys it to GitHub Pages, so a broken
  include or API change fails CI instead of surprising readers.
