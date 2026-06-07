import fs from 'node:fs';
import { PERSONAS_CONFIG_DIR, CONFIG_DIR } from './paths.js';

/**
 * Sanitise persona name for use as a filename.
 */
export function configFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Write the persona config file to ~/.config/git-personas/personas/<name>.config.
 * This is the single source of truth for persona config file format.
 */
export function writePersonaConfigFile(name: string, persona: {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.mkdirSync(PERSONAS_CONFIG_DIR, { recursive: true });

  const lines: string[] = [];

  lines.push('[user]');
  lines.push(`\tname = ${persona.user}`);
  lines.push(`\temail = ${persona.email}`);

  if (persona.gpgKey) {
    lines.push(`\tsigningkey = ${persona.gpgKey}`);
  }

  if (persona.gpgKey) {
    lines.push('');
    lines.push('[commit]');
    lines.push('\tgpgsign = true');
  }

  if (persona.sshKey) {
    lines.push('');
    lines.push('[core]');
    lines.push(`\tsshCommand = ssh -i ${persona.sshKey} -o IdentitiesOnly=yes`);
  }

  if (persona.defaultBranch) {
    lines.push('');
    lines.push('[init]');
    lines.push(`\tdefaultBranch = ${persona.defaultBranch}`);
  }

  const configPath = `${PERSONAS_CONFIG_DIR}/${configFileName(name)}.config`;
  fs.writeFileSync(configPath, lines.join('\n') + '\n');
}

/**
 * Delete a persona config file.
 */
export function deletePersonaConfigFile(name: string): void {
  const configPath = `${PERSONAS_CONFIG_DIR}/${configFileName(name)}.config`;
  try {
    fs.rmSync(configPath, { force: true });
  } catch {
    // File doesn't exist or can't be deleted — ignore
  }
}