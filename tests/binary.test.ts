import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BinaryDescriptor } from "../src/binary.js";
import { ensureBinary, installBinary } from "../src/ensure-binary.js";
import {
	CcusageError,
	ChecksumMismatchError,
	SessionNotFoundError,
	UnsupportedPlatformError,
} from "../src/errors.js";
import { run } from "../src/run.js";
import { runSessionCost } from "../src/session-cost.js";

const root = await mkdtemp(join(tmpdir(), "ccusage-lib-test-"));
const requests: string[] = [];
const payload = {
	inputTokens: 10,
	outputTokens: 20,
	cacheCreationTokens: 30,
	cacheReadTokens: 40,
	totalCost: 0.25,
};
const server = createServer(async (request, response) => {
	if (request.url === undefined) throw new Error("Request URL is missing");
	requests.push(request.url);
	if (request.url === "/failure") {
		response.writeHead(503).end();
		return;
	}
	response.end(await readFile(join(root, "fake.tgz")));
});

beforeAll(async () => {
	await mkdir(join(root, "package", "bin"), { recursive: true });
	await writeFile(
		join(root, "package", "bin", "ccusage"),
		`#!/bin/sh
if [ "$1" = "--version" ]; then printf 'fake-test-binary\\n'; exit 0; fi
if [ "$CODEX_HOME" != "/test/codex" ]; then echo 'env was not forwarded' >&2; exit 2; fi
case "$*" in
  'session --json --id missing --mode calculate') printf 'null\n';;
  'codex session --json --id missing --mode calculate') printf 'Error: CliError("No Codex session found with ID: missing")\n' >&2; exit 1;;
  'opencode session --json --id missing --mode calculate') printf 'Error: CliError("No OpenCode session found with ID: missing")\n' >&2; exit 1;;
  'codex session --json --id ambiguous --mode calculate') printf 'Error: CliError("Codex session ID ambiguous is ambiguous and matches 2 sessions.")\n' >&2; exit 1;;
  'session --json --id test-id --mode calculate') printf '%s\\n' '${JSON.stringify({ sessionId: "test-id", totalCost: payload.totalCost, entries: [payload] })}';;
  'codex session --json --id test-id --mode calculate'|'opencode session --json --id test-id --mode calculate') printf '%s\\n' '${JSON.stringify(payload)}';;
  *) echo 'wrong args' >&2; exit 3;;
esac
`,
	);
	await run("tar", ["-czf", join(root, "fake.tgz"), "-C", root, "package"]);
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

test("maps only exact release not-found errors, not other command failures", async () => {
	const binaryPath = await installBinary(
		await descriptor("not-found"),
		"darwin-arm64",
		{ cacheDir: join(root, "not-found") },
	);
	for (const harness of ["claude", "codex", "opencode"] as const) {
		await expect(
			runSessionCost(binaryPath, harness, {
				sessionId: "missing",
				env: { CODEX_HOME: "/test/codex" },
			}),
		).rejects.toBeInstanceOf(SessionNotFoundError);
	}
	try {
		await runSessionCost(binaryPath, "codex", {
			sessionId: "ambiguous",
			env: { CODEX_HOME: "/test/codex" },
		});
		throw new Error("Expected ambiguous session error");
	} catch (cause) {
		expect(cause).toBeInstanceOf(CcusageError);
		expect(cause).not.toBeInstanceOf(SessionNotFoundError);
	}
});

afterAll(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
	await rm(root, { recursive: true, force: true });
});

async function descriptor(version: string): Promise<BinaryDescriptor> {
	const address = server.address();
	if (address === null || typeof address === "string")
		throw new Error("Server is not listening");
	const hash = createHash("sha256")
		.update(await readFile(join(root, "fake.tgz")))
		.digest("hex");
	return {
		version,
		urlTemplate: `http://127.0.0.1:${address.port}/{version}/{target}`,
		sha256: { "darwin-arm64": hash, "darwin-x64": hash },
		executablePath: "package/bin/ccusage",
	};
}

test("downloads, verifies, caches, and executes a local tarball", async () => {
	const metadata = await descriptor("cache");
	const options = { cacheDir: join(root, "cache") };
	const before = requests.length;
	const binaryPath = await installBinary(metadata, "darwin-arm64", options);
	expect(binaryPath).toBe(resolve(options.cacheDir, "cache", "ccusage"));
	expect(await run(binaryPath, ["--version"])).toBe("fake-test-binary\n");
	expect(await installBinary(metadata, "darwin-arm64", options)).toBe(
		binaryPath,
	);
	expect(requests.length - before).toBe(1);
	expect(requests.at(-1)).toBe("/cache/darwin-arm64");
	expect(await readdir(options.cacheDir)).toEqual(["cache"]);
	for (const harness of ["claude", "codex", "opencode"] as const) {
		expect(
			await runSessionCost(binaryPath, harness, {
				sessionId: "test-id",
				env: { CODEX_HOME: "/test/codex" },
			}),
		).toEqual({
			inputTokens: 10,
			outputTokens: 20,
			cacheCreationTokens: 30,
			cacheReadTokens: 40,
			totalCostUsd: 0.25,
		});
	}
});

test("same-process install races all use the atomic winner", async () => {
	const metadata = await descriptor("race");
	const options = { cacheDir: join(root, "race") };
	const results = await Promise.all(
		Array.from({ length: 12 }, () =>
			installBinary(metadata, "darwin-x64", options),
		),
	);
	expect(new Set(results).size).toBe(1);
	expect(await readdir(options.cacheDir)).toEqual(["race"]);
});

test("separate processes racing installs all use the atomic winner", async () => {
	const metadata = await descriptor("process-race");
	const cacheDir = join(root, "process-race");
	const worker = new URL("./install-worker.ts", import.meta.url).pathname;
	const results = await Promise.all(
		Array.from({ length: 4 }, () =>
			run(process.execPath, [worker, JSON.stringify(metadata), cacheDir]),
		),
	);
	expect(new Set(results).size).toBe(1);
	expect(results[0]?.trim()).toBe(join(cacheDir, "process-race", "ccusage"));
	expect(await readdir(cacheDir)).toEqual(["process-race"]);
});

test("checksum mismatch does not leave a cache or staging directory", async () => {
	const metadata = await descriptor("bad-hash");
	metadata.sha256["darwin-arm64"] = "0".repeat(64);
	const options = { cacheDir: join(root, "bad-hash") };
	await expect(
		installBinary(metadata, "darwin-arm64", options),
	).rejects.toBeInstanceOf(ChecksumMismatchError);
	expect(await readdir(options.cacheDir)).toEqual([]);
});

test("HTTP errors and missing archive entries clean up staging", async () => {
	const metadata = await descriptor("failure");
	metadata.urlTemplate = metadata.urlTemplate.replace(
		"/{version}/{target}",
		"/failure",
	);
	const options = { cacheDir: join(root, "failure") };
	await expect(
		installBinary(metadata, "darwin-arm64", options),
	).rejects.toThrow("HTTP 503");
	metadata.urlTemplate = (await descriptor("failure")).urlTemplate;
	metadata.executablePath = "package/bin/missing";
	await expect(
		installBinary(metadata, "darwin-arm64", options),
	).rejects.toThrow("does not contain");
	expect(await readdir(options.cacheDir)).toEqual([]);
});

test("rejects unsafe metadata", async () => {
	const metadata = await descriptor("../escape");
	await expect(
		installBinary(metadata, "darwin-arm64", { cacheDir: root }),
	).rejects.toThrow("safe directory");
	metadata.version = "safe";
	metadata.executablePath = "../escape";
	await expect(
		installBinary(metadata, "darwin-arm64", { cacheDir: root }),
	).rejects.toThrow("parent traversal");
});

test.skipIf(
	process.platform === "darwin" && ["arm64", "x64"].includes(process.arch),
)(
	"production installation rejects unsupported platforms before downloading",
	async () => {
		await expect(
			ensureBinary({ cacheDir: join(root, "production") }),
		).rejects.toBeInstanceOf(UnsupportedPlatformError);
	},
);
