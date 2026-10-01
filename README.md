# ccusage-lib

Promise-based per-session API-price costs for Claude, Codex, and OpenCode. Plain
TypeScript, zero runtime dependencies, Node 22+ and Bun. macOS arm64/x64 only;
installation needs global `fetch` and system `tar`.

The binary is pinned to the fork's [`0.0.0-fdarian.2` release](https://github.com/fdarian/ccusage/releases/tag/v0.0.0-fdarian.2),
with verified SHA-256 values for both macOS architectures.

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
Claude exposes this flag in help; Codex and OpenCode accept the same flag even
though it is omitted from their subcommand help. Claude's token buckets are
summed from `entries`; all harnesses use top-level calculated `totalCost`.
Claude's JSON `null` and the exact Codex/OpenCode CLI not-found failures become
`SessionNotFoundError`; ambiguous IDs and other command failures stay `CcusageError`.
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
`package/bin/ccusage`, matching the pinned fork. Never put guessed URLs,
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

The gated test verifies the pinned version, numeric responses, and not-found
behavior. Compare each real result with the matching calculate-mode CLI session
before updating the pin; the test is not an independent price oracle.

## Publishing

The initial changeset bumps `0.0.0` to `0.1.0`. The release workflow runs on
changeset changes to main, opens a Version Packages PR, and publishes after its
merge with npm provenance and OIDC (no npm token). Check CI runs on Linux and
macOS, including the bundled library under Node.

Enable **Allow GitHub Actions to create and approve pull requests** in repository
settings. npm trusted publishing requires an existing package. Bootstrap
`ccusage-lib@0.0.0` manually from main before merging the initial Version Packages
PR, then configure npm's trusted publisher for GitHub Actions:

- Repository owner: `fdarian`
- Repository name: `ccusage-lib`
- Workflow filename: `release.yml`
- Environment name: leave empty (the job does not use a GitHub environment)
- Allowed action: `npm publish`

Do not bootstrap `0.1.0`: that is the Version PR's publish version. With a
verified npm account and 2FA, run `npm login`, then:

```sh
npm publish --access public --provenance=false
```

Local bootstrap cannot produce CI provenance. Subsequent CI publishes use OIDC
and provenance; no `NPM_TOKEN` or `NODE_AUTH_TOKEN` repository secret is needed.
