import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
	access,
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
	type BinaryDescriptor,
	type BinaryTarget,
	getBinaryDescriptor,
} from "./binary.js";
import {
	CcusageError,
	ChecksumMismatchError,
	UnsupportedPlatformError,
} from "./errors.js";
import { run } from "./run.js";

export type EnsureBinaryOptions = { cacheDir?: string | undefined };

function targetFor(platform: string, arch: string): BinaryTarget {
	if (platform !== "darwin" || (arch !== "arm64" && arch !== "x64")) {
		throw new UnsupportedPlatformError(platform, arch);
	}
	return `darwin-${arch}`;
}

function hasCode(cause: unknown, code: string): boolean {
	return cause instanceof Error && "code" in cause && cause.code === code;
}

async function isExecutable(path: string): Promise<boolean> {
	try {
		const stat = await lstat(path);
		if (!stat.isFile())
			throw new CcusageError(`Cached binary is not a regular file: ${path}`);
		await access(path, constants.X_OK);
		return true;
	} catch (cause) {
		if (hasCode(cause, "ENOENT")) return false;
		throw cause;
	}
}

export async function ensureBinary(
	options: EnsureBinaryOptions = {},
): Promise<string> {
	const target = targetFor(process.platform, process.arch);
	return installBinary(getBinaryDescriptor(), target, options);
}

/** Internal injection point for local tarball tests; not part of the package API. */
export async function installBinary(
	descriptor: BinaryDescriptor,
	target: BinaryTarget,
	options: EnsureBinaryOptions = {},
): Promise<string> {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(descriptor.version)) {
		throw new CcusageError("Binary version must be a safe directory name");
	}
	if (!/^[a-fA-F0-9]{64}$/.test(descriptor.sha256[target])) {
		throw new CcusageError(`Invalid SHA-256 for ${target}`);
	}
	if (
		isAbsolute(descriptor.executablePath) ||
		descriptor.executablePath.split("/").includes("..")
	) {
		throw new CcusageError(
			"Executable path must be relative without parent traversal",
		);
	}
	const root = resolve(
		options.cacheDir ??
			join(
				process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
				"ccusage-lib",
			),
	);
	const destination = join(root, descriptor.version);
	const executable = join(destination, "ccusage");
	if (await isExecutable(executable)) return executable;
	await mkdir(root, { recursive: true });
	// A random suffix also isolates concurrent installs within the same process.
	const staging = await mkdtemp(
		join(root, `${descriptor.version}.tmp-${process.pid}-`),
	);
	try {
		const url = descriptor.urlTemplate
			.replaceAll("{version}", descriptor.version)
			.replaceAll("{target}", target)
			.replaceAll("{platform}", "darwin")
			.replaceAll("{arch}", target.slice("darwin-".length));
		const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
		if (!response.ok)
			throw new CcusageError(`Binary download failed: HTTP ${response.status}`);
		const archive = new Uint8Array(await response.arrayBuffer());
		const actual = createHash("sha256").update(archive).digest("hex");
		if (actual !== descriptor.sha256[target].toLowerCase()) {
			throw new ChecksumMismatchError(descriptor.sha256[target], actual);
		}
		const archivePath = join(staging, "download.tgz");
		await writeFile(archivePath, archive);
		const contents = await run("tar", ["-tzf", archivePath]);
		if (!contents.split("\n").includes(descriptor.executablePath)) {
			throw new CcusageError(
				`Archive does not contain ${descriptor.executablePath}`,
			);
		}
		const unpacked = join(staging, "unpacked");
		await mkdir(unpacked);
		await run("tar", [
			"-xzf",
			archivePath,
			"-C",
			unpacked,
			descriptor.executablePath,
		]);
		const extracted = join(unpacked, descriptor.executablePath);
		if (!(await lstat(extracted)).isFile())
			throw new CcusageError("Archive executable is not a regular file");
		await rename(extracted, join(staging, "ccusage"));
		await chmod(join(staging, "ccusage"), 0o755);
		await rm(archivePath);
		await rm(unpacked, { recursive: true });
		try {
			await rename(staging, destination);
		} catch (cause) {
			if (
				!(hasCode(cause, "EEXIST") || hasCode(cause, "ENOTEMPTY")) ||
				!(await isExecutable(executable))
			)
				throw cause;
		}
		return executable;
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
}
