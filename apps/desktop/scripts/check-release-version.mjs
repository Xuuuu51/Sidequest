import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "../../..");
const releaseTag = process.argv[2] ?? "";

if (!/^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(releaseTag)) {
  throw new Error(
    `Release tag must look like v1.2.3 or v1.2.3-rc.1; received ${JSON.stringify(releaseTag)}`,
  );
}

const [desktopPackage, tauriConfig, cargoManifest] = await Promise.all([
  readJson(path.join(workspace, "apps/desktop/package.json")),
  readJson(path.join(workspace, "apps/desktop/src-tauri/tauri.conf.json")),
  readFile(path.join(workspace, "Cargo.toml"), "utf8"),
]);
const cargoVersion = cargoManifest.match(
  /\[workspace\.package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/,
)?.[1];
const expectedVersion = releaseTag.slice(1);
const versions = {
  "apps/desktop/package.json": desktopPackage.version,
  "apps/desktop/src-tauri/tauri.conf.json": tauriConfig.version,
  "Cargo.toml [workspace.package]": cargoVersion,
};
const mismatches = Object.entries(versions).filter(
  ([, version]) => version !== expectedVersion,
);

if (mismatches.length > 0) {
  const details = mismatches
    .map(([source, version]) => `${source}: ${String(version)}`)
    .join("\n");
  throw new Error(
    `Release tag ${releaseTag} does not match every package version:\n${details}`,
  );
}

console.log(`Release version ${expectedVersion} is consistent.`);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
