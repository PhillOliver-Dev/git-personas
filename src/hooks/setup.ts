import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const HOOKS_DIR = `${CONFIG_DIR}/hooks`;
const ZSH_PROMPT_DEST = `${CONFIG_DIR}/git-personas.zsh`;

const HOOKS = ['pre-commit', 'pre-push'] as const;

function getBuiltinHookPath(hookName: string): string {
  return path.join(__dirname, `${hookName}.js`);
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
  fs.mkdirSync(HOOKS_DIR, { recursive: true });

  for (const hookName of HOOKS) {
    const source = getBuiltinHookPath(hookName);
    if (!fs.existsSync(source)) {
      throw new Error(
        `Built hook not found at ${source}. Run "npm run build" first.`,
      );
    }

    const dest = `${HOOKS_DIR}/${hookName}`;
    fs.copyFileSync(source, dest);
    fs.chmodSync(dest, 0o755);
  }

  // Copy zsh prompt snippet for easy sourcing
  const zshSource = path.join(__dirname, '..', 'shell', 'git-personas.zsh');
  if (fs.existsSync(zshSource)) {
    fs.copyFileSync(zshSource, ZSH_PROMPT_DEST);
  }

  // Set global hooks path
  execSync(`git config --global core.hooksPath "${HOOKS_DIR}"`, {
    stdio: 'pipe',
  });
}

export function uninstallStickyHooks(): void {
  try {
    fs.rmSync(HOOKS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore if directory doesn't exist
  }

  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
}
