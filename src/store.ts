import { execSync } from 'child_process';
import fs from 'node:fs';
import os from 'node:os';

export interface Persona {
  name: string;
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}

export interface PersonaStore {
  personas: Persona[];
  active: string | null;
}

export interface PersonaSnapshot {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}

export interface RepoPersonaMapping {
  persona: string;
  snapshot: PersonaSnapshot;
  lastApplied: string;
}

export type RepoPersonas = Record<string, RepoPersonaMapping>;

const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const CONFIG_FILE = `${CONFIG_DIR}/personas.json`;
const REPO_PERSONAS_FILE = `${CONFIG_DIR}/repo-personas.json`;
const PERSONAS_CONFIG_DIR = `${CONFIG_DIR}/personas`;
const GITCONFIG_PATH = `${os.homedir()}/.gitconfig`;
const MANAGED_SECTION_START = '# === BEGIN git-personas managed config ===';
const MANAGED_SECTION_END = '# === END git-personas managed config ===';

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getRepoPersonasFile(): string {
  return REPO_PERSONAS_FILE;
}

export function getPersonasConfigDir(): string {
  return PERSONAS_CONFIG_DIR;
}

function configFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getCurrentGitProfile(): Persona | null {
  try {
    const user = execSync('git config --global user.name', { encoding: 'utf-8' }).trim();
    const email = execSync('git config --global user.email', { encoding: 'utf-8' }).trim();
    if (!user || !email) return null;

    let gpgKey: string | undefined;
    try {
      gpgKey = execSync('git config --global user.signingkey', { encoding: 'utf-8' }).trim() || undefined;
    } catch {
      // No signing key
    }

    let sshKey: string | undefined;
    try {
      const sshCmd = execSync('git config --global core.sshCommand', { encoding: 'utf-8' }).trim();
      const match = sshCmd.match(/-i\s+(\S+)/);
      if (match) sshKey = match[1];
    } catch {
      // No SSH command
    }

    let defaultBranch: string | undefined;
    try {
      defaultBranch = execSync('git config --global init.defaultBranch', { encoding: 'utf-8' }).trim() || undefined;
    } catch {
      // No default branch
    }

    return {
      name: 'default',
      user,
      email,
      gpgKey,
      sshKey,
      defaultBranch,
    };
  } catch {
    return null;
  }
}

export function importCurrentProfile(store: PersonaStore): PersonaStore {
  // Already has personas — don't import
  if (store.personas.length > 0) return store;

  const profile = getCurrentGitProfile();
  if (!profile) return store;

  const updated = addPersona(profile, store);
  return setActive(profile.name, updated);
}

export function ensureConfigDir(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadStore(): PersonaStore {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { personas: [], active: null };
  }
}

export function saveStore(store: PersonaStore): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2));
}

export function getPersona(name: string, store: PersonaStore): Persona | undefined {
  return store.personas.find((p) => p.name === name);
}

export function addPersona(persona: Persona, store: PersonaStore): PersonaStore {
  if (store.personas.find((p) => p.name === persona.name)) {
    throw new Error(`Persona "${persona.name}" already exists`);
  }
  return { ...store, personas: [...store.personas, persona] };
}

export function updatePersona(name: string, updates: Partial<Persona>, store: PersonaStore): PersonaStore {
  return {
    ...store,
    personas: store.personas.map((p) =>
      p.name === name ? { ...p, ...updates } : p
    ),
  };
}

export function deletePersona(name: string, store: PersonaStore): PersonaStore {
  return {
    ...store,
    personas: store.personas.filter((p) => p.name !== name),
    active: store.active === name ? null : store.active,
  };
}

export function setActive(name: string | null, store: PersonaStore): PersonaStore {
  return { ...store, active: name };
}

export interface GitKeys {
  gpgKeys: GpgKey[];
  sshKeys: SshKey[];
}

export interface GpgKey {
  id: string;
  uid: string;
}

export interface SshKey {
  path: string;
  comment: string;
}

export function detectGpgKeys(): GpgKey[] {
  try {
    const output = execSync('gpg --list-keys --with-colons 2>/dev/null', {
      encoding: 'utf-8',
    });
    const keys: GpgKey[] = [];
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('pub:')) {
        const parts = line.split(':');
        const keyId = parts[4];
        const uid = parts[9] || '';
        if (keyId && uid) {
          keys.push({
            id: keyId,
            uid: uid.substring(0, 60),
          });
        }
      }
    }
    return keys;
  } catch {
    return [];
  }
}

export function detectSshKeys(): SshKey[] {
  try {
    const sshDir = `${os.homedir()}/.ssh`;
    const keys: SshKey[] = [];
    const files = fs.readdirSync(sshDir);
    for (const file of files) {
      if (file.startsWith('id_') && !file.endsWith('.pub') && !file.endsWith('.pem')) {
        const pubFile = `${sshDir}/${file}.pub`;
        try {
          const comment = fs.readFileSync(pubFile, 'utf-8').trim().split(' ').slice(2).join(' ');
          keys.push({ path: `${sshDir}/${file}`, comment: comment || file });
        } catch {
          keys.push({ path: `${sshDir}/${file}`, comment: file });
        }
      }
    }
    return keys;
  } catch {
    return [];
  }
}

// --- includeIf-based persona config management ---

export function writePersonaConfigFile(name: string, persona: Persona): void {
  ensureConfigDir();
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

export function deletePersonaConfigFile(name: string): void {
  const configPath = `${PERSONAS_CONFIG_DIR}/${configFileName(name)}.config`;
  try {
    fs.rmSync(configPath, { force: true });
  } catch {
    // File doesn't exist or can't be deleted — ignore
  }
}

function removeManagedSection(gitconfig: string): string {
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

function updateGitconfigIncludesForPersona(personaName: string): void {
  const sanitisedName = configFileName(personaName);
  const configPath = `~/.config/git-personas/personas/${sanitisedName}.config`;

  let gitconfig = '';
  try {
    gitconfig = fs.readFileSync(GITCONFIG_PATH, 'utf-8');
  } catch {
    // File doesn't exist yet — that's fine
  }

  // Remove any existing managed section
  gitconfig = removeManagedSection(gitconfig);

  // Build the new managed section
  const section = [
    '',
    MANAGED_SECTION_START,
    `# Active persona: ${personaName}`,
    `# Managed by git-personas — do not edit between markers`,
    '',
    `[includeIf "gitdir:~/"]`,
    `\tpath = ${configPath}`,
    '',
    MANAGED_SECTION_END,
  ].join('\n');

  const content = gitconfig.trimEnd() + '\n' + section + '\n';
  fs.writeFileSync(GITCONFIG_PATH, content);
}

function readGitconfigContent(): string | null {
  try {
    return fs.readFileSync(GITCONFIG_PATH, 'utf-8');
  } catch {
    return null;
  }
}

function removeGitconfigManagedSection(): void {
  const gitconfigContent = readGitconfigContent();
  if (gitconfigContent === null) return;

  const cleaned = removeManagedSection(gitconfigContent);
  // If there's nothing left, remove the file entirely
  if (cleaned.trim() === '') {
    try {
      fs.rmSync(GITCONFIG_PATH);
    } catch {
      // Ignore
    }
    return;
  }

  fs.writeFileSync(GITCONFIG_PATH, cleaned);
}

function cleanupDirectGitConfig(): void {
  const unsetCommands = [
    'git config --global --unset user.name || true',
    'git config --global --unset user.email || true',
    'git config --global --unset user.signingkey || true',
    'git config --global --unset commit.gpgsign || true',
    'git config --global --unset core.sshCommand || true',
    'git config --global --unset init.defaultBranch || true',
  ];

  for (const cmd of unsetCommands) {
    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch {
      // Value already unset — ignore
    }
  }
}

export function applyPersona(persona: Persona): void {
  // 1. Write the persona config file
  writePersonaConfigFile(persona.name, persona);

  // 2. Clean up old direct git config values (migration from pre-includeIf system)
  cleanupDirectGitConfig();

  // 3. Update the includeIf block in ~/.gitconfig to point to this persona
  updateGitconfigIncludesForPersona(persona.name);
}

export function clearActivePersona(): void {
  // 1. Clean up old direct git config values
  cleanupDirectGitConfig();

  // 2. Remove the includeIf managed section from ~/.gitconfig
  removeGitconfigManagedSection();
}

export function takeSnapshot(persona: Persona): PersonaSnapshot {
  return {
    user: persona.user,
    email: persona.email,
    gpgKey: persona.gpgKey,
    sshKey: persona.sshKey,
    defaultBranch: persona.defaultBranch,
  };
}

export function getChangedFields(persona: Persona, snapshot: PersonaSnapshot): string[] {
  const changes: string[] = [];
  if (persona.user !== snapshot.user) changes.push('user.name');
  if (persona.email !== snapshot.email) changes.push('user.email');
  if (persona.gpgKey !== snapshot.gpgKey) changes.push('GPG key');
  if (persona.sshKey !== snapshot.sshKey) changes.push('SSH key');
  if (persona.defaultBranch !== snapshot.defaultBranch) changes.push('default branch');
  return changes;
}

export function loadRepoPersonas(): RepoPersonas {
  try {
    const data = fs.readFileSync(REPO_PERSONAS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveRepoPersonas(repoPersonas: RepoPersonas): void {
  ensureConfigDir();
  fs.writeFileSync(REPO_PERSONAS_FILE, JSON.stringify(repoPersonas, null, 2));
}

export function setRepoPersona(repoPath: string, persona: Persona): RepoPersonas {
  const repoPersonas = loadRepoPersonas();
  repoPersonas[repoPath] = {
    persona: persona.name,
    snapshot: takeSnapshot(persona),
    lastApplied: new Date().toISOString(),
  };
  saveRepoPersonas(repoPersonas);
  return repoPersonas;
}

export function removeRepoPersona(repoPath: string): RepoPersonas {
  const repoPersonas = loadRepoPersonas();
  delete repoPersonas[repoPath];
  saveRepoPersonas(repoPersonas);
  return repoPersonas;
}
