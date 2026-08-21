import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateControlledUserJobManifestHash } from "../../shared/controlledUserJob";

const fixturePath = resolve(process.cwd(), "fixtures/controlled-user-job-manifest.json");
const manifest = JSON.parse(readFileSync(fixturePath, "utf8"));
console.log(calculateControlledUserJobManifestHash(manifest));
