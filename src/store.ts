import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

// Re-export types
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

export interface PathMapping {
  path: string;
  persona: string;
}

export type PathMappings = PathMapping[];

// Import from lib modules
import {
  CONFIG_DIR,
  PERSONAS_CONFIG_DIR,
  PERSONAS_FILE,
  REPO_PERSONAS_FILE,
  PATH_MAPPINGS_FILE,
} from './lib/paths.js';

import {
  readGitConfig,
  getCurrentGitProfile,
} from './lib/git.js';

import {
  writeManagedSection,
  removeManagedSection,
  readGitconfigContent,
  writeGitconfigContent,
  backupGitconfig,
} from './lib/gitconfig.js';

import {
  writePersonaConfigFile as writePersonaConfigFileInternal,
  deletePersonaConfigFile as deletePersonaConfigFileInternal,
} from './lib/persona-config.js';

import {
  takeSnapshot as takeSnapshotInternal,
  getChangedFields,
} from './lib/snapshot.js';

import { GITCONFIG_PATH } from './lib/paths.js';

// Re-export lib functions for backward compatibility
export { readGitConfig, readGitconfigContent, removeManagedSection };
export { takeSnapshot as takeSnapshotInternal, getChangedFields };
export { writePersonaConfigFileInternal as writePersonaConfigFile, deletePersonaConfigFileInternal as deletePersonaConfigFile };
export { CONFIG_DIR, PERSONAS_CONFIG_DIR, PERSONAS_FILE, REPO_PERSONAS_FILE, PATH_MAPPINGS_FILE };

// --- Store management ---

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getPersonasConfigDir(): string {
  return PERSONAS_CONFIG_DIR;
}

export function ensureConfigDir(): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadStore(): PersonaStore {
  try {
    const data = fs.readFileSync(PERSONAS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { personas: [], active: null };
  }
}

export function saveStore(store: PersonaStore): void {
  ensureConfigDir();
  fs.writeFileSync(PERSONAS_FILE, JSON.stringify(store, null, 2));
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
  if (updates.name !== undefined && updates.name !== name) {
    throw new Error('Cannot rename persona. Use delete and recreate to change the name.');
  }
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

export function importCurrentProfile(store: PersonaStore): PersonaStore {
  const profile = getCurrentGitProfile();
  if (!profile) return store;

  // If a persona with this name already exists, don't re-add it
  if (getPersona(profile.name, store)) {
    return store;
  }

  const updated = addPersona(profile, store);
  return setActive(profile.name, updated);
}

// --- Key detection ---

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

// --- Persona application ---

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
  writePersonaConfigFileInternal(persona.name, persona);

  // 2. Clean up old direct git config values (migration from pre-includeIf system)
  cleanupDirectGitConfig();

  // 3. Update the includeIf block in ~/.gitconfig
  writeManagedSection({ activePersona: persona.name });
}

export function clearActivePersona(): void {
  // 1. Clean up old direct git config values
  cleanupDirectGitConfig();

  // 2. Remove the managed section from ~/.gitconfig
  const gitconfigContent = readGitconfigContent();
  if (gitconfigContent === null) return;

  const cleaned = removeManagedSection(gitconfigContent);
  // If there's nothing left, remove the file entirely
  if (cleaned.trim() === '') {
    try {
      backupGitconfig();
      fs.rmSync(GITCONFIG_PATH);
    } catch {
      // Ignore
    }
    return;
  }

  writeGitconfigContent(cleaned);
}

// --- Path-based auto-switch ---

export function loadPathMappings(): PathMappings {
  try {
    const data = fs.readFileSync(PATH_MAPPINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function savePathMappings(mappings: PathMappings): void {
  ensureConfigDir();
  fs.writeFileSync(PATH_MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

export function addPathMapping(path: string, persona: string): PathMappings {
  const mappings = loadPathMappings();
  
  const existingIndex = mappings.findIndex((m) => m.path === path);
  if (existingIndex >= 0) {
    mappings[existingIndex].persona = persona;
  } else {
    mappings.push({ path, persona });
  }
  
  savePathMappings(mappings);
  return mappings;
}

export function removePathMapping(path: string): PathMappings {
  const mappings = loadPathMappings().filter((m) => m.path !== path);
  savePathMappings(mappings);
  return mappings;
}

export function updateGitconfigWithPathMappings(mappings: PathMappings, activePersona: string | null): void {
  writeManagedSection({ activePersona, pathMappings: mappings });
}

export function getEffectivePersonaForPath(repoPath: string, mappings: PathMappings): string | null {
  const sortedMappings = [...mappings].sort((a, b) => {
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return bDepth - aDepth;
  });

  for (const mapping of sortedMappings) {
    const pattern = mapping.path.replace('gitdir:', '').replace(/^"(.*)"$/, '$1');
    const expandedPattern = pattern.replace(/^~/, os.homedir());
    if (repoPath.startsWith(expandedPattern) || repoPath.startsWith(expandedPattern.replace('**', ''))) {
      return mapping.persona;
    }
  }
  return null;
}

// --- Snapshot and diff ---

export function takeSnapshot(persona: Persona): PersonaSnapshot {
  return takeSnapshotInternal(persona);
}

// --- Repo personas ---

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