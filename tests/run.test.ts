import { expect, test } from "bun:test";
import { CcusageError } from "../src/errors.js";
import { run } from "../src/run.js";

test("runs without a shell, preserves arguments, and merges environment", async () => {
	const stdout = await run(
		process.execPath,
		[
			"-e",
			"console.log(JSON.stringify([process.argv[1], process.env.CC_TEST, Boolean(process.env.PATH)]))",
			"a; echo unsafe",
		],
		{ env: { CC_TEST: "forwarded" } },
	);
	expect(JSON.parse(stdout)).toEqual(["a; echo unsafe", "forwarded", true]);
});

test("nonzero exit carries stderr and code", async () => {
	try {
		await run(process.execPath, [
			"-e",
			"console.error('failure'); process.exit(7)",
		]);
		throw new Error("Expected process failure");
	} catch (cause) {
		expect(cause).toBeInstanceOf(CcusageError);
		if (!(cause instanceof CcusageError)) throw cause;
		expect(cause.stderr).toBe("failure\n");
		expect(cause.exitCode).toBe(7);
	}
});

test("spawn failure is wrapped", async () => {
	await expect(run("/nonexistent/ccusage-test", [])).rejects.toBeInstanceOf(
		CcusageError,
	);
});

test("timeout kills a running process", async () => {
	await expect(
		run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
			timeoutMs: 50,
		}),
	).rejects.toThrow("timed out");
});

test("invalid timeout is rejected", () => {
	for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
		expect(() => run(process.execPath, [], { timeoutMs })).toThrow(RangeError);
	}
});
