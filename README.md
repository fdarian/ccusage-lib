# ccusage-lib

Promise-based per-session API-price costs for Claude, Codex, and OpenCode. Plain
TypeScript, zero runtime dependencies, Node 22+ and Bun. macOS arm64/x64 only;
installation needs global `fetch` and system `tar`.

**Release preparation:** the binary descriptor is deliberately unconfigured.
`ensureBinary` and `sessionCost` throw `BinaryConfigurationError` on supported
machines until verified fork release metadata is added. Nothing is published yet.
Parser fixtures use the supplied oagent Claude/Codex reference; OpenCode follows
the planned Codex-compatible targeted response. Confirm all shapes and not-found
behavior against the fork's Release notes before publishing.

## Usage

```ts
import { sessionCost, SessionNotFoundError } from "ccusage-lib";

try {
  const cost = await sessionCost({
    harness: "codex", // "claude" | "codex" | "opencode"
    sessionId: "your-session-id",
    env: { CODEX_HOME: "/Users/you/.codex-oagent" },
    timeoutMs: 60_000,
  });
  console.log(cost.totalCostUsd);
} catch (error) {
  if (error instanceof SessionNotFoundError) console.error(error.message);
  else throw error;
}
```

Returns `{ inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens,
totalCostUsd }`. Each command targets `session --json --id` with
`--mode calculate` to report API-price cost rather than recorded provider cost.
Environment overrides merge with `process.env`. Timeout applies to each binary
invocation; download separately has a 60-second deadline.

Exports also include `claudeSessionCost`, `codexSessionCost`,
`opencodeSessionCost` (same options without `harness`), `ensureBinary({ cacheDir? })`,
and `run(binaryPath, args, { env?, timeoutMs? })` returning stdout. Nonzero exits
throw `CcusageError` with `stderr` and `exitCode`; malformed responses also throw,
never produce fabricated token counts. Unsupported platforms and checksum
mismatches have dedicated exported error classes.

## Cache and binary pin

Default executable: `${XDG_CACHE_HOME ?? ~/.cache}/ccusage-lib/<version>/ccusage`.
`cacheDir` overrides the **ccusage-lib cache root**, not the version directory.
Returned paths are absolute. Cache hits do not download again. SHA-256 is checked
before extraction. Unique `<version>.tmp-<pid>-<suffix>` staging directories and
an atomic rename make concurrent installs safe across tasks and processes.
Failed installs remove their own staging directories. A preexisting broken or
non-executable cache is an error; remove that version directory to reinstall.
Cache hits trust the local filesystem; they do not rehash the executable.

To pin the fork or switch to upstream npm platform tarballs, edit only
`src/binary.ts`: provide `version`, `urlTemplate`, `sha256` for `darwin-arm64` and
`darwin-x64`, and `executablePath`. Template placeholders are `{version}`,
`{target}`, `{platform}`, and `{arch}`. Upstream npm's inspected layout is
`package/bin/ccusage`; confirm the fork uses that layout. Never put guessed URLs,
versions, or checksums in the production descriptor.

## Development

```sh
pnpm install --frozen-lockfile
pnpm run check
```

Uses pnpm, Bun tests, Biome, strict TypeScript, and tsdown ESM/declaration builds.
Local tests serve a fake tarball over HTTP: no release or network required.
Real-download/session verification is opt-in:

```sh
CCUSAGE_TEST_REAL=1 \
CCUSAGE_TEST_CLAUDE_SESSION_ID=... \
CCUSAGE_TEST_CODEX_SESSION_ID=... \
CCUSAGE_TEST_OPENCODE_SESSION_ID=... \
CODEX_HOME="$HOME/.codex-oagent" bun test tests/real.test.ts
```

Compare each real result with the matching CLI session before release; the gated
test verifies download/execution and numeric responses, not an independent price
oracle.

## Publishing

The initial changeset bumps `0.0.0` to `0.1.0`. The release workflow runs on
changeset changes to main, opens a Version Packages PR, and publishes after its
merge with npm provenance and OIDC (no npm token). Check CI runs on Linux and
macOS, including the bundled library under Node.

Before the first push, configure the binary pin and verify real sessions. When
the GitHub repository is created, enable **Allow GitHub Actions to create and
approve pull requests**. npm trusted publishing requires an existing package:
bootstrap the first publish manually with `npm publish --access public`, then
configure npm's trusted publisher for `fdarian/ccusage-lib`, `release.yml` on
`main`. No GitHub repository or remote is created by local setup.
