import { type EnsureBinaryOptions, ensureBinary } from "./ensure-binary.js";
import { CcusageError, SessionNotFoundError } from "./errors.js";
import { type RunOptions, run } from "./run.js";

export type Harness = "claude" | "codex" | "opencode";

export type SessionCost = {
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	totalCostUsd: number;
};

export type HarnessSessionCostOptions = EnsureBinaryOptions &
	RunOptions & {
		sessionId: string;
	};

export type SessionCostOptions = HarnessSessionCostOptions & {
	harness: Harness;
};

function object(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new CcusageError("Invalid ccusage response: expected an object");
	}
	return value as Record<string, unknown>;
}

function number(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new CcusageError(
			`Invalid ccusage response: ${field} must be a nonnegative finite number`,
		);
	}
	return value;
}

function tokens(
	entry: Record<string, unknown>,
): Omit<SessionCost, "totalCostUsd"> {
	return {
		inputTokens: number(entry.inputTokens, "inputTokens"),
		outputTokens: number(entry.outputTokens, "outputTokens"),
		cacheCreationTokens: number(
			entry.cacheCreationTokens,
			"cacheCreationTokens",
		),
		cacheReadTokens: number(entry.cacheReadTokens, "cacheReadTokens"),
	};
}

/** Kept internal so release fixtures can test decoding independently of installation. */
export function parseSessionCost(
	harness: Harness,
	sessionId: string,
	stdout: string,
): SessionCost {
	const response: unknown = (() => {
		try {
			return JSON.parse(stdout);
		} catch (cause) {
			throw new CcusageError(`Invalid ccusage ${harness} JSON`, "", null, {
				cause,
			});
		}
	})();
	if (response === null) throw new SessionNotFoundError(harness, sessionId);
	const entry = object(response);
	if (harness === "claude") {
		if (typeof entry.sessionId !== "string")
			throw new CcusageError("Invalid ccusage response: missing sessionId");
		if (entry.sessionId !== sessionId)
			throw new SessionNotFoundError(harness, sessionId);
		if (!Array.isArray(entry.entries))
			throw new CcusageError(
				"Invalid ccusage response: expected entries array",
			);
		const totals = entry.entries.reduce<Omit<SessionCost, "totalCostUsd">>(
			(total, value: unknown) => {
				const counts = tokens(object(value));
				return {
					inputTokens: total.inputTokens + counts.inputTokens,
					outputTokens: total.outputTokens + counts.outputTokens,
					cacheCreationTokens:
						total.cacheCreationTokens + counts.cacheCreationTokens,
					cacheReadTokens: total.cacheReadTokens + counts.cacheReadTokens,
				};
			},
			{
				inputTokens: 0,
				outputTokens: 0,
				cacheCreationTokens: 0,
				cacheReadTokens: 0,
			},
		);
		return { ...totals, totalCostUsd: number(entry.totalCost, "totalCost") };
	}
	return {
		...tokens(entry),
		totalCostUsd: number(entry.totalCost, "totalCost"),
	};
}

async function harnessSessionCost(
	harness: Harness,
	options: HarnessSessionCostOptions,
): Promise<SessionCost> {
	if (options.sessionId.trim().length === 0)
		throw new TypeError("sessionId must not be empty");
	const binaryPath = await ensureBinary(options);
	return runSessionCost(binaryPath, harness, options);
}

export async function runSessionCost(
	binaryPath: string,
	harness: Harness,
	options: HarnessSessionCostOptions,
): Promise<SessionCost> {
	const prefix = harness === "claude" ? [] : [harness];
	const stdout = await run(
		binaryPath,
		[
			...prefix,
			"session",
			"--json",
			"--id",
			options.sessionId,
			"--mode",
			"calculate",
		],
		options,
	).catch((cause: unknown) => {
		const label = harness === "codex" ? "Codex" : "OpenCode";
		const missing = `Error: CliError("No ${label} session found with ID: ${options.sessionId}")\n`;
		if (
			harness !== "claude" &&
			cause instanceof CcusageError &&
			cause.exitCode === 1 &&
			cause.stderr === missing
		) {
			throw new SessionNotFoundError(harness, options.sessionId);
		}
		throw cause;
	});
	return parseSessionCost(harness, options.sessionId, stdout);
}

export function claudeSessionCost(
	options: HarnessSessionCostOptions,
): Promise<SessionCost> {
	return harnessSessionCost("claude", options);
}

export function codexSessionCost(
	options: HarnessSessionCostOptions,
): Promise<SessionCost> {
	return harnessSessionCost("codex", options);
}

export function opencodeSessionCost(
	options: HarnessSessionCostOptions,
): Promise<SessionCost> {
	return harnessSessionCost("opencode", options);
}

export function sessionCost(options: SessionCostOptions): Promise<SessionCost> {
	switch (options.harness) {
		case "claude":
			return claudeSessionCost(options);
		case "codex":
			return codexSessionCost(options);
		case "opencode":
			return opencodeSessionCost(options);
		default:
			throw new TypeError(`Unsupported harness: ${String(options.harness)}`);
	}
}
