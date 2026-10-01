import { spawn } from "node:child_process";
import { CcusageError } from "./errors.js";

export type RunOptions = {
	env?: NodeJS.ProcessEnv | undefined;
	timeoutMs?: number | undefined;
};

export function run(
	binaryPath: string,
	args: readonly string[],
	options: RunOptions = {},
): Promise<string> {
	const timeoutMs = options.timeoutMs ?? 60_000;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		throw new RangeError("timeoutMs must be a positive finite number");
	}
	return new Promise((resolve, reject) => {
		const stdout: string[] = [];
		const stderr: string[] = [];
		const child = spawn(binaryPath, args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, ...options.env },
		});
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => stdout.push(chunk));
		child.stderr.on("data", (chunk: string) => stderr.push(chunk));
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(
				new CcusageError(
					`ccusage timed out after ${timeoutMs}ms`,
					stderr.join(""),
				),
			);
		}, timeoutMs);
		child.on("error", (cause) => {
			clearTimeout(timer);
			reject(
				new CcusageError("Could not start ccusage", stderr.join(""), null, {
					cause,
				}),
			);
		});
		child.on("close", (code, signal) => {
			clearTimeout(timer);
			if (code !== 0) {
				reject(
					new CcusageError(
						`ccusage exited with ${signal ?? code}`,
						stderr.join(""),
						code,
					),
				);
				return;
			}
			resolve(stdout.join(""));
		});
	});
}
