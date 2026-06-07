import fs from 'node:fs';
import {
  GITCONFIG_PATH,
  MANAGED_SECTION_START,
  MANAGED_SECTION_END,
  BACKUPS_DIR,
} from './paths.js';

/**
 * Read ~/.gitconfig content.
 */
export function readGitconfigContent(): string | null {
  try {
    return fs.readFileSync(GITCONFIG_PATH, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Remove the managed git-personas section from gitconfig content.
 */
export function removeManagedSection(gitconfig: string): string {
  const startIdx = gitconfig.indexOf(MANAGED_SECTION_START);
  const endIdx = gitconfig.indexOf(MANAGED_SECTION_END);

  if (startIdx === -1 || endIdx === -1) {
    return gitconfig;
  }

  const before = gitconfig.substring(0, startIdx);
  const after = gitconfig.substring(endIdx + MANAGED_SECTION_END.length);

  // Collapse multiple blank lines that result from removal
  return (before + after).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/**
 * Backup gitconfig to ~/.config/git-personas/backups/.
 * Keeps only the last 10 backups.
 */
export function backupGitconfig(): void {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${BACKUPS_DIR}/gitconfig-${timestamp}.backup`;
    fs.copyFileSync(GITCONFIG_PATH, backupPath);
    
    // Keep only last 10 backups
    const backups = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith('gitconfig-') && f.endsWith('.backup'))
      .sort()
      .reverse()
      .slice(10);
    for (const old of backups) {
      fs.rmSync(`${BACKUPS_DIR}/${old}`, { force: true });
    }
  } catch {
    // Ignore backup failures
  }
}

/**
 * Atomically write content to ~/.gitconfig.
 * Creates a backup if the file exists.
 */
export function writeGitconfigContent(content: string): void {
  const tmpPath = `${GITCONFIG_PATH}.tmp`;
  
  // Backup existing file
  if (fs.existsSync(GITCONFIG_PATH)) {
    backupGitconfig();
  }
  
  // Write to temp file first
  fs.writeFileSync(tmpPath, content);
  
  // Atomic rename
  fs.renameSync(tmpPath, GITCONFIG_PATH);
}

/**
 * Options for writing the managed section.
 */
export interface ManagedSectionOptions {
  activePersona: string | null;
  pathMappings?: Array<{ path: string; persona: string }>;
}

/**
 * Build the managed section content for ~/.gitconfig.
 */
export function buildManagedSection(opts: ManagedSectionOptions): string {
  const { activePersona, pathMappings = [] } = opts;
  const lines: string[] = [
    '',
    MANAGED_SECTION_START,
    `# Active persona: ${activePersona || '(none)'}`,
    `# Managed by git-personas — do not edit between markers`,
  ];

  if (pathMappings.length === 0 && activePersona) {
    // No path mappings, use default fallback
    const configPath = `~/.config/git-personas/personas/${activePersona}.config`;
    lines.push('');
    lines.push(`[includeIf "gitdir:~/"]`);
    lines.push(`\tpath = ${configPath}`);
  } else if (pathMappings.length > 0) {
    // Path mappings defined
    for (const mapping of pathMappings) {
      const configPath = `~/.config/git-personas/personas/${mapping.persona}.config`;
      lines.push('');
      lines.push(`[includeIf "${mapping.path}"]`);
      lines.push(`\tpath = ${configPath}`);
      lines.push(`\t# Persona: ${mapping.persona}`);
    }
  }

  lines.push('');
  lines.push(MANAGED_SECTION_END);

  return lines.join('\n');
}

/**
 * Write the managed section to ~/.gitconfig.
 * This is the single source of truth for gitconfig writing.
 */
export function writeManagedSection(opts: ManagedSectionOptions): void {
  let gitconfig = '';
  try {
    gitconfig = fs.readFileSync(GITCONFIG_PATH, 'utf-8');
  } catch {
    // File doesn't exist yet — that's fine
  }

  // Remove any existing managed section
  gitconfig = removeManagedSection(gitconfig);

  // Build and append the new managed section
  const section = buildManagedSection(opts);
  const content = gitconfig.trimEnd() + '\n' + section + '\n';
  
  writeGitconfigContent(content);
}