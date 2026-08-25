import { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const profile = process.argv[2] === "release" ? "release" : "debug";
const targetTriple =
  process.env.SIDEQUEST_BUILD_TARGET?.trim() ||
  process.env.TAURI_ENV_TARGET_TRIPLE?.trim() ||
  null;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, "../../..");
const resources = path.join(workspace, "apps/desktop/src-tauri/resources");
const buildArguments = ["build", "-p", "sidequest-cli", "--locked"];
if (profile === "release") buildArguments.push("--release");
if (targetTriple !== null) buildArguments.push("--target", targetTriple);

const build = spawnSync("cargo", buildArguments, {
  cwd: workspace,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

await mkdir(resources, { recursive: true });
const source = path.join(
  workspace,
  "target",
  ...(targetTriple === null ? [] : [targetTriple]),
  profile,
  "sq",
);
const target = path.join(resources, "sq");
await copyFile(source, target);
await chmod(target, 0o755);

const desktopPackage = JSON.parse(
  await readFile(path.join(scriptDirectory, "../package.json"), "utf8"),
);
const expectedVersion = `sq ${desktopPackage.version}`;
if (targetTriple === null || targetTriple.startsWith(hostRustArchitecture())) {
  const version = spawnSync(target, ["--version"], { encoding: "utf8" });
  if (version.status !== 0 || version.stdout.trim() !== expectedVersion) {
    throw new Error(
      `Bundled sq version ${JSON.stringify(version.stdout.trim())} does not match ${JSON.stringify(expectedVersion)}`,
    );
  }
}

function hostRustArchitecture() {
  if (process.arch === "arm64") return "aarch64-";
  if (process.arch === "x64") return "x86_64-";
  return `${process.arch}-`;
}
