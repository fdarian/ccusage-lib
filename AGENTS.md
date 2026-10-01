# ccusage-lib

Small promise-based library for per-session API-price cost from a pinned ccusage
binary. Plain TypeScript, no runtime dependencies or Effect. Supports macOS
arm64/x64 on Node 22+ and Bun; extraction uses system `tar`.

## Map

- `src/binary.ts` — sole production release descriptor; deliberately unconfigured
  until verified fork release metadata is available.
- `src/ensure-binary.ts` — checksum verification and atomic versioned cache install.
- `src/run.ts` — process execution, environment overrides, timeout and errors.
- `src/session-cost.ts` — targeted harness invocations and strict response parsing.
- `src/index.ts` — public API; internal test injection helpers are not re-exported.
- `tests/` — Bun parsing, execution and fake-tarball tests; real test is opt-in.
- [README](./README.md) — API, cache, descriptor updates, verification and publishing.

## Commands and conventions

Use pnpm for dependencies, `bun test` for tests, `pnpm run check` for lint,
typecheck, tests and tsdown build. ESM and declaration output live in `dist/`.
Use explicit property access, no destructuring; malformed data must throw rather
than fall back to fabricated values.

Release uses Changesets and npm OIDC. Add changesets with `bunx changeset`.
Do not guess production descriptor values or publish without real-binary
verification. The fork is a separate repository, not part of this library.
