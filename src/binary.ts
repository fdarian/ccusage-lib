import { BinaryConfigurationError } from "./errors.js";

export type BinaryTarget = "darwin-arm64" | "darwin-x64";

export type BinaryDescriptor = {
	version: string;
	urlTemplate: string;
	sha256: Record<BinaryTarget, string>;
	executablePath: string;
};

/** Remains unconfigured until the fork release supplies verified metadata. */
export const binary: BinaryDescriptor | undefined = undefined;

export function getBinaryDescriptor(): BinaryDescriptor {
	if (binary === undefined) throw new BinaryConfigurationError();
	return binary;
}
