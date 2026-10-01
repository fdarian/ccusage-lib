export type BinaryTarget = "darwin-arm64" | "darwin-x64";

export type BinaryDescriptor = {
	version: string;
	urlTemplate: string;
	sha256: Record<BinaryTarget, string>;
	executablePath: string;
};

export const binary: BinaryDescriptor = {
	version: "0.0.0-fdarian.2",
	urlTemplate:
		"https://github.com/fdarian/ccusage/releases/download/v{version}/ccusage-{target}.tgz",
	sha256: {
		"darwin-arm64":
			"b64605b0c83ff9b79bfff56342302bf8c170ffa286f3b143f42a7b973e27dd28",
		"darwin-x64":
			"0dfe92268d27ea000a5b1aaccb24f1f1f21dd4dbf11dc630950706ff165a2b75",
	},
	executablePath: "package/bin/ccusage",
};

export function getBinaryDescriptor(): BinaryDescriptor {
	return binary;
}
