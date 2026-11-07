# Next.js example

`page.tsx` is a Client Component (`'use client'`) — the whole
family is browser-only by design, so there is no server action
or upload route. For the guaranteed-best compression, register
the WASM codecs with `codecPlugin` from `@dusrel/image` (see
the playground) instead of relying on canvas AVIF support.
