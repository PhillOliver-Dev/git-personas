import { execSync } from 'node:child_process';

/**
 * Read a git config value safely. Returns undefined if not set.
 * Reads the effective config (includes includeIf values).
 */
export function readGitConfig(key: string): string | undefined {
  try {
    const value = execSync(`git config ${key}`, { encoding: 'utf-8' }).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read the effective git profile (including includeIf values).
 * Returns a persona-like object with default name if profile exists.
 * When non-null, user and email are guaranteed to be non-empty strings.
 */
export function getCurrentGitProfile(): {
  name: string;
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
} | null {
  const user = readGitConfig('user.name');
  const email = readGitConfig('user.email');
  
  if (!user || !email) return null;
  
  const gpgKey = readGitConfig('user.signingkey');
  
  let sshKey: string | undefined;
  const sshCmd = readGitConfig('core.sshCommand');
  if (sshCmd) {
    const match = sshCmd.match(/-i\s+(\S+)/);
    if (match) sshKey = match[1];
  }
  
  const defaultBranch = readGitConfig('init.defaultBranch');
  
  return {
    name: 'default',
    user,
    email,
    gpgKey,
    sshKey,
    defaultBranch,
  };
}