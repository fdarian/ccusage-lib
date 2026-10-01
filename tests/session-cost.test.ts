import { expect, test } from "bun:test";
import { CcusageError, SessionNotFoundError } from "../src/errors.js";
import {
	type Harness,
	parseSessionCost,
	sessionCost,
} from "../src/session-cost.js";

const entry = {
	inputTokens: 10,
	outputTokens: 20,
	cacheCreationTokens: 30,
	cacheReadTokens: 40,
	totalCost: 0.125,
};
const expected = {
	inputTokens: 10,
	outputTokens: 20,
	cacheCreationTokens: 30,
	cacheReadTokens: 40,
	totalCostUsd: 0.125,
};

test("Claude sums entries and uses the session cost", () => {
	expect(
		parseSessionCost(
			"claude",
			"test",
			JSON.stringify({
				sessionId: "test",
				totalCost: 0.25,
				entries: [entry, entry],
			}),
		),
	).toEqual({
		inputTokens: 20,
		outputTokens: 40,
		cacheCreationTokens: 60,
		cacheReadTokens: 80,
		totalCostUsd: 0.25,
	});
	expect(
		parseSessionCost(
			"claude",
			"test",
			JSON.stringify({ sessionId: "test", totalCost: 0, entries: [] }),
		),
	).toEqual({
		inputTokens: 0,
		outputTokens: 0,
		cacheCreationTokens: 0,
		cacheReadTokens: 0,
		totalCostUsd: 0,
	});
});

for (const harness of ["codex", "opencode"] as const) {
	test(`${harness} parses a targeted cost entry`, () => {
		expect(parseSessionCost(harness, "test", JSON.stringify(entry))).toEqual(
			expected,
		);
	});
}

for (const harness of ["claude", "codex", "opencode"] as const) {
	test(`${harness} reports null as not found`, () => {
		expect(() => parseSessionCost(harness, "missing", "null")).toThrow(
			SessionNotFoundError,
		);
	});
	test(`${harness} rejects invalid JSON and invalid objects`, () => {
		for (const raw of ["", "not json", "[]", "{}", "42"]) {
			expect(() => parseSessionCost(harness, "test", raw)).toThrow(
				CcusageError,
			);
		}
	});
}

test("Claude mismatched IDs are not found", () => {
	expect(() =>
		parseSessionCost(
			"claude",
			"missing",
			JSON.stringify({ sessionId: "other", totalCost: 0, entries: [] }),
		),
	).toThrow(SessionNotFoundError);
});

test("does not silently replace malformed numbers", () => {
	for (const value of [undefined, null, "10", -1]) {
		expect(() =>
			parseSessionCost(
				"codex",
				"test",
				JSON.stringify({ ...entry, inputTokens: value }),
			),
		).toThrow(CcusageError);
	}
	expect(() =>
		parseSessionCost("codex", "test", '{"inputTokens":1e999}'),
	).toThrow(CcusageError);
});

test("validates public dispatch inputs before installation", async () => {
	await expect(
		sessionCost({ harness: "codex", sessionId: " " }),
	).rejects.toThrow("sessionId must not be empty");
	expect(() =>
		sessionCost({ harness: "unknown" as Harness, sessionId: "test" }),
	).toThrow("Unsupported harness");
});
