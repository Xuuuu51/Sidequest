import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const targetDirectory = join(repositoryRoot, "target");
const profileDirectory = join(targetDirectory, "desktop-debug-profile");

function ensureSafeTarget() {
  if (
    existsSync(targetDirectory) &&
    lstatSync(targetDirectory).isSymbolicLink()
  ) {
    throw new Error("Refusing to use a symlinked target directory.");
  }
  if (
    existsSync(profileDirectory) &&
    lstatSync(profileDirectory).isSymbolicLink()
  ) {
    throw new Error("Refusing to use a symlinked debug profile.");
  }
  if (resolve(profileDirectory) !== profileDirectory) {
    throw new Error(
      "Debug profile path did not resolve to the expected target.",
    );
  }
}

function resetProfile() {
  ensureSafeTarget();
  rmSync(profileDirectory, { recursive: true, force: true });
  mkdirSync(profileDirectory, { recursive: true });
  process.stdout.write(`Reset isolated profile: ${profileDirectory}\n`);
}

function runDesktop() {
  ensureSafeTarget();
  mkdirSync(profileDirectory, { recursive: true });
  const child = spawn(
    "pnpm",
    ["--filter", "@sidequest/desktop", "tauri", "dev"],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        SIDEQUEST_DEBUG_PROFILE_DIR: profileDirectory,
      },
      stdio: "inherit",
    },
  );
  child.on("error", (error) => {
    process.stderr.write(
      `Could not start isolated Desktop: ${error.message}\n`,
    );
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

const action = process.argv[2];
if (action === "reset") {
  resetProfile();
} else if (action === "run") {
  runDesktop();
} else {
  process.stderr.write("Usage: desktop-isolated.mjs <run|reset>\n");
  process.exitCode = 2;
}
