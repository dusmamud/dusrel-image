# ADR-0005: Lockstep versioning for all @dusrel/image-* packages
- Status: Accepted (2026-11-07)

## Context
Sub-packages depend on each other. Independent versions create mismatch
bugs that are hard for users to diagnose (the failure mode of many
multi-package families).

## Decision
All `@dusrel/image-*` packages share one version and release together,
managed with Changesets. A change to any package bumps the family version.

## Consequences
Users can safely install any combination at the same version. Releases are
slightly heavier (all packages publish each time), accepted in exchange for
zero version-mismatch support burden.
