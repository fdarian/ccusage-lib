export type BinaryTarget = "darwin-arm64" | "darwin-x64";

export type BinaryDescriptor = {
	version: string;
	urlTemplate: string;
	sha256: Record<BinaryTarget, string>;
	executablePath: string;
};

export const binary: BinaryDescriptor = {
	version: "0.0.0-fdarian.3",
	urlTemplate:
		"https://github.com/fdarian/ccusage/releases/download/v{version}/ccusage-{target}.tgz",
	sha256: {
		"darwin-arm64":
			"e907980fe198214b361a7717e71e3d493ec3e44ad59bd7a859a48f1d37bc1e78",
		"darwin-x64":
			"32d6a4ae3e44e815946c32c746ba8afab6997f478228bdb3051a931227b14d8e",
	},
	executablePath: "package/bin/ccusage",
};

export function getBinaryDescriptor(): BinaryDescriptor {
	return binary;
}
