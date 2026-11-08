# Docs site

The VitePress documentation site for the @dusrel/image family.

```bash
pnpm --filter @dusrel/docs-site dev     # local dev server
pnpm --filter @dusrel/docs-site build   # TypeDoc API + static site
```

How it fits together:

- **Guide pages** (`guide/*.md`) are thin wrappers that
  `@include` the single-source documents in the repo's `docs/`
  folder — edit those, never the wrappers.
- **API reference**: `build:api` runs TypeDoc over every
  public package's entry points and emits HTML into
  `public/api/` (generated, git-ignored), which VitePress
  copies into the built site at `/api/`.
- The **Docs GitHub Actions workflow** builds the whole site
  on every docs change, so a broken include or API change
  fails CI instead of surprising readers.

Deployment target is any static host; the site is plain
HTML/CSS/JS under `.vitepress/dist/`.
