# Examples

Minimal, read-in-one-sitting examples — one per folder:

| Folder | What it shows |
| --- | --- |
| `vanilla/` | `processImage` + a pipeline with an adjust plugin, no framework |
| `react/` | File input → process → preview/download, with the report in state |
| `vue/` | The same flow as a Vue single-file component |
| `next/` | A Next.js client component (`'use client'`) |
| `nuxt/` | A Nuxt component wrapped for client-only rendering |
| `cdn/` | Import-map + CDN modules, no install, no build step |

Imports point at the published npm packages (`@dusrel/image`
etc.). Until the first npm release, swap the specifiers for
local `dist/` paths exactly like `apps/playground` does.
