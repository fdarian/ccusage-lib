# ccusage-lib

Small promise-based library for per-session API-price cost from a pinned ccusage
binary. Plain TypeScript, no runtime dependencies or Effect. Supports macOS
arm64/x64 on Node 22+ and Bun; extraction uses system `tar`.

## Map

- `src/binary.ts` — sole production release descriptor, pinned to the fork's
  `0.0.0-fdarian.3` release.
- `src/ensure-binary.ts` — checksum verification and atomic versioned cache install.
- `src/run.ts` — process execution, environment overrides, timeout and errors.
- `src/session-cost.ts` — targeted harness invocations and strict response parsing.
- `src/index.ts` — public API; internal test injection helpers are not re-exported.
- `tests/` — Bun parsing, execution and fake-tarball tests; real test is opt-in.
- [README](./README.md) — installation, public API, supported platforms, cache and errors.

## Commands and conventions

Use pnpm for dependencies, `bun test` for tests, `pnpm run check` for lint,
typecheck, tests and tsdown build. ESM and declaration output live in `dist/`.
Use explicit property access, no destructuring; malformed data must throw rather
than fall back to fabricated values.

Release uses Changesets and npm OIDC. Add changesets with `bunx changeset`.
Do not guess production descriptor values or publish without real-binary
verification. The fork is a separate repository, not part of this library.
Update binary pins only in `src/binary.ts`. Real verification uses
`CCUSAGE_TEST_REAL=1` and `CCUSAGE_TEST_{CLAUDE,CODEX,OPENCODE}_SESSION_ID`
with `bun test tests/real.test.ts`; compare results with the calculate-mode CLI.
The release workflow watches `.changeset/**`; dispatch it manually to refresh
the Version PR after other main-branch changes.
