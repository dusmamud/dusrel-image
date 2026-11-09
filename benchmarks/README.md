# Benchmarks

`run.mjs` times the shipped packages end to end: every WASM codec
encode/decode, the optimiser, quantize, resize, placeholders, metadata
and SVG optimisation — 14 operations, medians after a warmup.

Corpus: three deterministic synthetic images generated inside the
runner from a seeded PRNG (photo-like gradient + per-pixel noise,
flat UI-like blocks, alpha pattern). Licence-clean by construction —
the generator is the source, so no binary corpus is committed. A
real-photograph corpus is future work; until then these numbers are
for regression tracking, not marketing.

Run it:

```sh
pnpm build
node benchmarks/run.mjs   # writes benchmarks/results.md
```

The Benchmarks GitHub workflow runs it weekly and on manual dispatch
and uploads `results.md` plus the size-limit snapshot as artifacts.
Method and the latest headline numbers: `docs/PERFORMANCE.md`.
