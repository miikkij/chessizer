#!/usr/bin/env node
/**
 * Cross-platform launcher for the Python WAV generator backend.
 * Used by `pnpm dev` to start Vite + WAV server together.
 */
import { spawnSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

const cwd = join(import.meta.dirname, "..", "soundAgentsv2");
const python = [".venv", "venv"].flatMap(directory => [
    join(cwd, directory, "Scripts", "python.exe"),
    join(cwd, directory, "bin", "python"),
]).find(existsSync);
const setup = process.platform === "win32"
    ? "cd soundAgentsv2\n  py -3.13 -m venv .venv\n  .venv\\Scripts\\python.exe -m pip install -r requirements.txt"
    : "cd soundAgentsv2\n  python3.12 -m venv .venv\n  .venv/bin/python -m pip install -r requirements.txt";

if (!python) {
    console.error(
        "[wav] Python environment not found. Set up Python 3.12 or newer:\n  " + setup
    );
    process.exit(1);
}

const version = spawnSync(python, ["-c", "import sys; print('.'.join(map(str, sys.version_info[:3]))); sys.exit(0 if sys.version_info >= (3, 12) else 1)"], {
    cwd, encoding: "utf8", windowsHide: true,
});
if (version.status !== 0) {
    console.error(`[wav] Python 3.12 or newer is required. Found ${version.stdout?.trim() || "an unusable interpreter"} at ${python}.\n  ${setup}`);
    process.exit(1);
}

const result = spawnSync(python, ["main.py"], { cwd, stdio: "inherit", windowsHide: true });
if (result.error) console.error(`[wav] Could not start Python: ${result.error.message}`);
process.exit(result.status ?? 1);
