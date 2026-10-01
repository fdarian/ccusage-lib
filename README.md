# ccusage-lib

Get per-session API-price costs for Claude Code, Codex, and OpenCode from
TypeScript or JavaScript. Promise-based, with zero runtime dependencies.
Costs are calculated from tokens, not recorded provider costs.

## Install

```sh
npm install ccusage-lib
```

Requires Node.js 22+ or Bun, macOS on Apple Silicon or Intel, and system `tar`.
Linux and Windows are not supported. The package is ESM-only.

## Usage

```ts
import { sessionCost, SessionNotFoundError } from "ccusage-lib";

try {
  const cost = await sessionCost({
    harness: "codex",
    sessionId: "your-session-id",
    // Optional: use a different Codex data directory.
    env: { CODEX_HOME: "/Users/you/.codex" },
  });
  console.log(cost.totalCostUsd);
} catch (error) {
  if (error instanceof SessionNotFoundError) console.error(error.message);
  else throw error;
}
```

`harness` accepts `"claude"`, `"codex"`, or `"opencode"`. Sessions are read from
the harness's local data store. OpenCode requires the exact session ID; Codex
also accepts a session filename, relative session path, or `codex://threads/<UUID>`.

The result contains five numbers:

```ts
type SessionCost = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCostUsd: number;
};
```

Optional settings:

- `env`: environment overrides merged with `process.env`, such as `CODEX_HOME`.
- `cacheDir`: an alternative binary cache root.
- `timeoutMs`: command timeout in milliseconds; defaults to `60_000`.

`claudeSessionCost`, `codexSessionCost`, and `opencodeSessionCost` take the same
options without `harness`.

## Binary download and cache

The first call downloads a pinned native ccusage binary from the
[`fdarian/ccusage` GitHub release](https://github.com/fdarian/ccusage/releases/tag/v0.0.0-fdarian.2),
verifies its SHA-256 checksum, and extracts it using system `tar`. An internet
connection is required for the first download, which has a 60-second deadline.
The fork supports targeted OpenCode session lookup and token-based API pricing.
You do not need to install ccusage separately.

The executable is cached at:

```text
$XDG_CACHE_HOME/ccusage-lib/0.0.0-fdarian.2/ccusage
```

If `XDG_CACHE_HOME` is unset, the base directory is `~/.cache`.
With `cacheDir`, the path is `<cacheDir>/0.0.0-fdarian.2/ccusage`.
Subsequent calls reuse the cached executable; concurrent downloads are safe.
Cached binaries are trusted locally and are not rehashed on each call. Remove
the version directory to reinstall a damaged or non-executable cache.

For direct access, `ensureBinary({ cacheDir? })` returns the absolute executable
path, and `run(binaryPath, args, { env?, timeoutMs? })` returns stdout.

## Errors

All library error classes extend `CcusageError`:

- `SessionNotFoundError`: no matching session; includes `harness` and `sessionId`.
- `UnsupportedPlatformError`: unsupported OS or architecture.
- `ChecksumMismatchError`: downloaded archive failed verification; includes
  `expected` and `actual` hashes.
- `CcusageError`: command failures, timeouts, malformed responses, and invalid
  binary archives. Command failures include `stderr` and `exitCode`.

Ambiguous Codex IDs are command errors, not missing sessions. Invalid arguments
can also throw `TypeError` or `RangeError`; filesystem and network errors may
propagate directly. Failures never produce fabricated zero-cost results.
