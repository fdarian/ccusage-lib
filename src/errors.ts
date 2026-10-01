export class CcusageError extends Error {
	override readonly name: string = "CcusageError";
	constructor(
		message: string,
		readonly stderr: string = "",
		readonly exitCode: number | null = null,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

export class UnsupportedPlatformError extends CcusageError {
	override readonly name = "UnsupportedPlatformError";
	constructor(
		readonly platform: string,
		readonly arch: string,
	) {
		super(`Unsupported platform: ${platform}-${arch}; macOS arm64/x64 only`);
	}
}

export class ChecksumMismatchError extends CcusageError {
	override readonly name = "ChecksumMismatchError";
	constructor(
		readonly expected: string,
		readonly actual: string,
	) {
		super(`Binary checksum mismatch: expected ${expected}, received ${actual}`);
	}
}

export class SessionNotFoundError extends CcusageError {
	override readonly name = "SessionNotFoundError";
	constructor(
		readonly harness: string,
		readonly sessionId: string,
	) {
		super(`No ${harness} session found with ID: ${sessionId}`);
	}
}
