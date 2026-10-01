import type { BinaryDescriptor } from "../src/binary.js";
import { installBinary } from "../src/ensure-binary.js";

const metadata = process.argv[2];
const cacheDir = process.argv[3];
if (metadata === undefined || cacheDir === undefined)
	throw new Error("Missing worker arguments");
const descriptor: BinaryDescriptor = JSON.parse(metadata);
console.log(await installBinary(descriptor, "darwin-arm64", { cacheDir }));
