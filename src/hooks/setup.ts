import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const HOOKS_DIR = `${CONFIG_DIR}/hooks`;

const HOOKS = ['pre-commit', 'pre-push'] as const;

const PROMPT_MARKER = '# git-personas — show active persona in prompt';

interface ShellConfig {
  dest: string;
  rcPath: string;
  sourceFile: string;
  sourceLine: string;
  matchPattern: string;
}

function getShellConfigs(): ShellConfig[] {
  const configs: ShellConfig[] = [];

  // Zsh
  const zshDest = `${CONFIG_DIR}/git-personas.zsh`;
  const zshSource = path.join(__dirname, '..', 'shell', 'git-personas.zsh');
  configs.push({
    dest: zshDest,
    rcPath: `${os.homedir()}/.zshrc`,
    sourceFile: zshSource,
    sourceLine: `source ${zshDest}`,
    matchPattern: 'git-personas.zsh',
  });

  // Bash
  const bashDest = `${CONFIG_DIR}/git-personas.bash`;
  const bashSource = path.join(__dirname, '..', 'shell', 'git-personas.bash');
  configs.push({
    dest: bashDest,
    rcPath: `${os.homedir()}/.bashrc`,
    sourceFile: bashSource,
    sourceLine: `source ${bashDest}`,
    matchPattern: 'git-personas.bash',
  });

  return configs;
}

function addSourceLine(rcPath: string, sourceLine: string, matchPattern: string): void {
  if (!fs.existsSync(rcPath)) return;

  const rc = fs.readFileSync(rcPath, 'utf-8');
  if (rc.includes(matchPattern)) return;

  fs.appendFileSync(rcPath, `\n\n${PROMPT_MARKER}\n${sourceLine}\n`);
}

function removeSourceLine(rcPath: string, matchPattern: string): void {
  if (!fs.existsSync(rcPath)) return;

  const rc = fs.readFileSync(rcPath, 'utf-8');
  if (!rc.includes(matchPattern)) return;

  const lines = rc.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.includes(matchPattern)) return false;
    if (trimmed === PROMPT_MARKER) return false;
    return true;
  });

  const cleaned = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(rcPath, cleaned);
}

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

  // Copy shell prompt snippets and add source lines to rc files
  for (const config of getShellConfigs()) {
    if (fs.existsSync(config.sourceFile)) {
      fs.copyFileSync(config.sourceFile, config.dest);
      addSourceLine(config.rcPath, config.sourceLine, config.matchPattern);
    }
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

  // Remove source lines from shell rc files
  for (const config of getShellConfigs()) {
    removeSourceLine(config.rcPath, config.matchPattern);
  }

  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
}
