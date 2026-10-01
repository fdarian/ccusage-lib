import { expect, test } from "bun:test";
import {
	binary,
	ensureBinary,
	type Harness,
	run,
	SessionNotFoundError,
	sessionCost,
} from "../src/index.js";

test.skipIf(process.env.CCUSAGE_TEST_REAL !== "1")(
	"downloads and executes the pinned release",
	async () => {
		const binaryPath = await ensureBinary();
		expect((await run(binaryPath, ["--version"])).trim()).toContain(
			binary.version,
		);
		for (const harness of [
			"claude",
			"codex",
			"opencode",
		] as const satisfies readonly Harness[]) {
			const sessionId =
				process.env[`CCUSAGE_TEST_${harness.toUpperCase()}_SESSION_ID`];
			if (sessionId === undefined)
				throw new Error(`Missing real ${harness} session ID`);
			const result = await sessionCost({ harness, sessionId });
			expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
			await expect(
				sessionCost({
					harness,
					sessionId: "ccusage-lib-missing-session-2847c9f8",
				}),
			).rejects.toBeInstanceOf(SessionNotFoundError);
		}
	},
	180_000,
);
