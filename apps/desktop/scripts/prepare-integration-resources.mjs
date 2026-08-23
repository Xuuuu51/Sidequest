import { chmod, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const profile = process.argv[2] === "release" ? "release" : "debug";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "../../..");
const resources = path.join(workspace, "apps/desktop/src-tauri/resources");
const buildArguments = ["build", "-p", "sidequest-cli", "--locked"];
if (profile === "release") buildArguments.push("--release");

const build = spawnSync("cargo", buildArguments, {
  cwd: workspace,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

await mkdir(resources, { recursive: true });
const source = path.join(workspace, "target", profile, "sq");
const target = path.join(resources, "sq");
await copyFile(source, target);
await chmod(target, 0o755);

const version = spawnSync(target, ["--version"], { encoding: "utf8" });
if (version.status !== 0 || !version.stdout.includes("0.1.0")) {
  throw new Error(
    "Bundled sq version does not match the Desktop package version",
  );
}
