#!/usr/bin/env node
/**
 * Cross-platform launcher for the Python WAV generator backend.
 * Used by `pnpm dev` to start Vite + WAV server together.
 */
import { execSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

const cwd = join(import.meta.dirname, "..", "soundAgentsv2");
const venvWin = join(cwd, "venv", "Scripts", "python.exe");
const venvUnix = join(cwd, "venv", "bin", "python");

const python = existsSync(venvWin) ? venvWin
    : existsSync(venvUnix) ? venvUnix
    : null;

if (!python) {
    console.error(
        "\x1b[33m[wav]\x1b[0m Python venv not found. Run this first:\n" +
        "  cd soundAgentsv2 && python -m venv venv && venv\\Scripts\\pip install -r requirements.txt"
    );
    process.exit(1);
}

try {
    execSync(`"${python}" main.py`, { cwd, stdio: "inherit" });
} catch (e) {
    process.exit(e.status ?? 1);
}
