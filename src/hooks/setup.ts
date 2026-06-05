import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const HOOKS_DIR = `${CONFIG_DIR}/hooks`;
const PRE_COMMIT_HOOK = `${HOOKS_DIR}/pre-commit`;

// The compiled hook lives at dist/hooks/pre-commit.js relative to this file
function getBuiltinHookPath(): string {
  // This file is at dist/hooks/setup.js, so the pre-commit is at dist/hooks/pre-commit.js
  return path.join(__dirname, 'pre-commit.js');
}

export function isStickyEnabled(): boolean {
  try {
    const hooksPath = execSync('git config --global core.hooksPath', {
      encoding: 'utf-8',
    }).trim();
    return hooksPath === HOOKS_DIR;
  } catch {
    return false;
  }
}

export function installStickyHooks(): void {
  // Build the hooks directory
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // Copy the hook script from the package
  const source = getBuiltinHookPath();
  if (!fs.existsSync(source)) {
    throw new Error(
      `Built hook not found at ${source}. Run "npm run build" first.`,
    );
  }

  fs.copyFileSync(source, PRE_COMMIT_HOOK);
  fs.chmodSync(PRE_COMMIT_HOOK, 0o755);

  // Set global hooks path
  execSync(`git config --global core.hooksPath "${HOOKS_DIR}"`, {
    stdio: 'pipe',
  });
}

export function uninstallStickyHooks(): void {
  // Remove the hooks directory
  try {
    fs.rmSync(HOOKS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if directory doesn't exist
  }

  // Unset global hooks path
  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
}
