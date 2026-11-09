# Architecture Decision Records (ADR)

Every major, hard-to-reverse decision for dusrel-image is recorded here as a
short file: context, decision, consequences. ADRs are immutable once accepted;
to change a decision, add a new ADR that supersedes the old one and link both.

## Index

- [ADR-0001](0001-sub-package-architecture.md) — Sub-package architecture modelled on jSquash
- [ADR-0002](0002-no-backend-client-side-only.md) — No backend — client-side only, forever
- [ADR-0003](0003-reuse-native-codec-engines.md) — Build the family from scratch; reuse proven codec engines
- [ADR-0004](0004-languages-and-build.md) — Languages and build toolchain
- [ADR-0005](0005-lockstep-versioning.md) — Lockstep versioning for all @dusrel/image-* packages
- [ADR-0006](0006-single-thread-default.md) — Single-threaded WASM by default
- [ADR-0007](0007-plugin-api-stabilisation.md) — Plugin API stabilisation
- [ADR-0008](0008-heic-decode-investigation.md) — HEIC decode — investigation and licence position
- [ADR-0009](0009-placeholder-package.md) — Placeholder package — ThumbHash + BlurHash, pure TypeScript
