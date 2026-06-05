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

export type ShellName = 'bash' | 'zsh' | 'starship';

interface ShellConfig {
  name: ShellName;
  dest: string;
  rcPath: string;
  sourceFile: string;
  sourceLine: string;
  matchPattern: string;
}

const SHELL_CONFIGS: ShellConfig[] = [
  {
    name: 'bash',
    dest: `${CONFIG_DIR}/git-personas.bash`,
    rcPath: `${os.homedir()}/.bashrc`,
    sourceFile: path.join(__dirname, '..', 'shell', 'git-personas.bash'),
    sourceLine: `source ${CONFIG_DIR}/git-personas.bash`,
    matchPattern: 'git-personas.bash',
  },
  {
    name: 'zsh',
    dest: `${CONFIG_DIR}/git-personas.zsh`,
    rcPath: `${os.homedir()}/.zshrc`,
    sourceFile: path.join(__dirname, '..', 'shell', 'git-personas.zsh'),
    sourceLine: `source ${CONFIG_DIR}/git-personas.zsh`,
    matchPattern: 'git-personas.zsh',
  },
];

// --- Starship integration ---

const STARSHIP_CONFIG_PATH = `${os.homedir()}/.config/starship.toml`;
const STARSHIP_SCRIPT_DEST = `${CONFIG_DIR}/git-personas-starship.sh`;
const STARSHIP_SCRIPT_SOURCE = path.join(__dirname, '..', 'shell', 'git-personas-starship.sh');
const STARSHIP_MATCH_PATTERN = 'custom.git_persona';

const STARSHIP_TOML_BLOCK = `\
[custom.git_persona]
command = "${STARSHIP_SCRIPT_DEST}"
when = "true"
format = "👤 $output "
style = "cyan bold"`;

function isStarshipInstalled(): boolean {
  try {
    execSync('which starship', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function installStarshipPrompt(): void {
  // Copy the extraction script
  if (fs.existsSync(STARSHIP_SCRIPT_SOURCE)) {
    fs.copyFileSync(STARSHIP_SCRIPT_SOURCE, STARSHIP_SCRIPT_DEST);
    fs.chmodSync(STARSHIP_SCRIPT_DEST, 0o755);
  }

  // Ensure starship.toml exists
  let toml = '';
  if (fs.existsSync(STARSHIP_CONFIG_PATH)) {
    toml = fs.readFileSync(STARSHIP_CONFIG_PATH, 'utf-8');
  }

  if (toml.includes(STARSHIP_MATCH_PATTERN)) return; // Already integrated

  const block = `\n${PROMPT_MARKER}\n${STARSHIP_TOML_BLOCK}\n`;
  fs.writeFileSync(STARSHIP_CONFIG_PATH, toml + block, 'utf-8');
}

function removeStarshipPrompt(): void {
  if (!fs.existsSync(STARSHIP_CONFIG_PATH)) return;

  const toml = fs.readFileSync(STARSHIP_CONFIG_PATH, 'utf-8');
  if (!toml.includes(STARSHIP_MATCH_PATTERN)) return;

  // Remove everything from the marker line through the TOML block
  const lines = toml.split('\n');
  const markerIndex = lines.findIndex((l) => l.trim() === PROMPT_MARKER);

  if (markerIndex >= 0) {
    // Marker found — remove marker + our [custom.git_persona] section header + all key=value lines
    let end = markerIndex + 1;
    while (end < lines.length) {
      const trimmed = lines[end].trim();
      // Stop at blank line or a different section
      if (trimmed === '' || (trimmed.startsWith('[') && !trimmed.startsWith(`[${STARSHIP_MATCH_PATTERN}]`))) break;
      end++;
    }
    lines.splice(markerIndex, end - markerIndex);
  } else {
    // No marker but block exists — remove just the [custom.git_persona] section
    const blockIndex = lines.findIndex((l) => l.trim() === `[${STARSHIP_MATCH_PATTERN}]`);
    if (blockIndex >= 0) {
      let end = blockIndex + 1;
      while (end < lines.length) {
        const trimmed = lines[end].trim();
        if (trimmed === '' || trimmed.startsWith('[')) break;
        end++;
      }
      lines.splice(blockIndex, end - blockIndex);
    }
  }

  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  if (cleaned) {
    fs.writeFileSync(STARSHIP_CONFIG_PATH, cleaned + '\n', 'utf-8');
  } else {
    // Empty file — remove it
    fs.unlinkSync(STARSHIP_CONFIG_PATH);
  }
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

/** Check which shell rc files exist (and starship if installed) */
export function detectShells(): ShellName[] {
  const shells = SHELL_CONFIGS.filter((s) => fs.existsSync(s.rcPath)).map((s) => s.name);
  if (isStarshipInstalled()) {
    shells.push('starship');
  }
  return shells;
}

/** Check if a specific shell already has the prompt integration */
export function isShellIntegrated(shell: ShellName): boolean {
  if (shell === 'starship') {
    if (!fs.existsSync(STARSHIP_CONFIG_PATH)) return false;
    return fs.readFileSync(STARSHIP_CONFIG_PATH, 'utf-8').includes(STARSHIP_MATCH_PATTERN);
  }
  const config = SHELL_CONFIGS.find((s) => s.name === shell);
  if (!config) return false;
  if (!fs.existsSync(config.rcPath)) return false;
  const rc = fs.readFileSync(config.rcPath, 'utf-8');
  return rc.includes(config.matchPattern);
}

/** Install prompt integration for a specific shell */
export function installShellPrompt(shell: ShellName): void {
  if (shell === 'starship') {
    installStarshipPrompt();
    return;
  }
  const config = SHELL_CONFIGS.find((s) => s.name === shell);
  if (!config || !fs.existsSync(config.rcPath)) return;

  // Copy the snippet
  if (fs.existsSync(config.sourceFile)) {
    fs.copyFileSync(config.sourceFile, config.dest);
  }

  // Add source line if not already there
  const rc = fs.readFileSync(config.rcPath, 'utf-8');
  if (!rc.includes(config.matchPattern)) {
    fs.appendFileSync(config.rcPath, `\n\n${PROMPT_MARKER}\n${config.sourceLine}\n`);
  }
}

/** Remove prompt integration for a specific shell */
export function removeShellPrompt(shell: ShellName): void {
  if (shell === 'starship') {
    removeStarshipPrompt();
    return;
  }
  const config = SHELL_CONFIGS.find((s) => s.name === shell);
  if (!config || !fs.existsSync(config.rcPath)) return;

  const rc = fs.readFileSync(config.rcPath, 'utf-8');
  if (!rc.includes(config.matchPattern)) return;

  const lines = rc.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.includes(config.matchPattern)) return false;
    if (trimmed === PROMPT_MARKER) return false;
    return true;
  });

  const cleaned = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  fs.writeFileSync(config.rcPath, cleaned);
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

  // Remove source lines from all shell rc files
  for (const config of SHELL_CONFIGS) {
    removeShellPrompt(config.name);
  }

  // Remove starship integration
  removeShellPrompt('starship');

  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
}
