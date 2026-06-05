#!/usr/bin/env node

/**
 * git-personas pre-commit hook
 *
 * Runs before every commit. If sticky personas are enabled:
 * - First commit in a repo: prompts to select a persona
 * - Returning to a repo: auto-applies the saved persona
 * - If persona changed since last use: warns and asks to confirm
 * - Single persona: just notifies, no interaction
 * - Non-TTY: silently skips
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import readline from 'node:readline';

// --- Config paths ---
const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const PERSONAS_FILE = `${CONFIG_DIR}/personas.json`;
const REPO_PERSONAS_FILE = `${CONFIG_DIR}/repo-personas.json`;
const HOOKS_DIR = `${CONFIG_DIR}/hooks`;

// --- Helpers ---
function loadJson<T>(path: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function saveJson(path: string, data: unknown): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function takeSnapshot(persona: Persona): PersonaSnapshot {
  return {
    user: persona.user,
    email: persona.email,
    gpgKey: persona.gpgKey,
    sshKey: persona.sshKey,
    defaultBranch: persona.defaultBranch,
  };
}

function getChangedFields(persona: Persona, snapshot: PersonaSnapshot): string[] {
  const changes: string[] = [];
  if (persona.user !== snapshot.user) changes.push('user.name');
  if (persona.email !== snapshot.email) changes.push('user.email');
  if (persona.gpgKey !== snapshot.gpgKey) changes.push('GPG key');
  if (persona.sshKey !== snapshot.sshKey) changes.push('SSH key');
  if (persona.defaultBranch !== snapshot.defaultBranch) changes.push('default branch');
  return changes;
}

function applyPersona(persona: Persona): void {
  const commands: string[] = [
    `git config --global user.name "${persona.user}"`,
    `git config --global user.email "${persona.email}"`,
  ];

  if (persona.gpgKey) {
    commands.push(
      `git config --global user.signingkey ${persona.gpgKey}`,
      `git config --global commit.gpgsign true`,
    );
  } else {
    commands.push(
      `git config --global --unset commit.gpgsign || true`,
      `git config --global --unset user.signingkey || true`,
    );
  }

  if (persona.sshKey) {
    commands.push(
      `git config --global core.sshCommand "ssh -i ${persona.sshKey} -o IdentitiesOnly=yes"`,
    );
  } else {
    commands.push(`git config --global --unset core.sshCommand || true`);
  }

  if (persona.defaultBranch) {
    commands.push(`git config --global init.defaultBranch ${persona.defaultBranch}`);
  } else {
    commands.push(`git config --global --unset init.defaultBranch || true`);
  }

  for (const cmd of commands) {
    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch {
      // Ignore unset errors for missing keys
    }
  }
}

function ask(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function askChoice(rl: readline.Interface, question: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    console.log(question);
    options.forEach((opt, i) => console.log(`  [${i + 1}] ${opt}`));
    rl.question('\nSelect (number): ', (answer: string) => {
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= options.length) {
        resolve(num - 1);
      } else {
        resolve(0);
      }
    });
  });
}

// --- Types ---
interface Persona {
  name: string;
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}

interface PersonaSnapshot {
  user: string;
  email: string;
  gpgKey?: string;
  sshKey?: string;
  defaultBranch?: string;
}

interface RepoPersonaMapping {
  persona: string;
  snapshot: PersonaSnapshot;
  lastApplied: string;
}

interface PersonaStore {
  personas: Persona[];
  active: string | null;
}

// --- Main ---
function cleanupHooks(): void {
  // Remove the hooks directory
  try {
    fs.rmSync(HOOKS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
  // Unset global hooks path
  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
  console.log('git-personas: Package no longer installed. Global git hooks cleaned up.');
}

function isPackageInstalled(): boolean {
  try {
    execSync('command -v git-personas', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  // Not a TTY — silently skip
  if (!process.stdout.isTTY) {
    process.exit(0);
  }

  // Check if git-personas is still installed — self-cleanup if not
  if (!isPackageInstalled()) {
    cleanupHooks();
    process.exit(0);
  }

  // Get repo path
  let repoPath: string;
  try {
    repoPath = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    // Not inside a git repo
    process.exit(0);
  }

  // Load personas
  const store = loadJson<PersonaStore>(PERSONAS_FILE);
  if (!store || !store.personas || store.personas.length === 0) {
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Load repo→persona mapping
  const repoPersonas = loadJson<Record<string, RepoPersonaMapping>>(REPO_PERSONAS_FILE) || {};
  const mapping = repoPersonas[repoPath];

  try {
    if (mapping) {
      // --- Repo has a saved persona ---
      const persona = store.personas.find((p) => p.name === mapping.persona);

      if (!persona) {
        // Persona was deleted — prompt to select a new one
        console.log(`\ngit-personas: The persona "${mapping.persona}" assigned to this repo has been deleted.`);
        const idx = await askChoice(rl, 'Select a persona:', store.personas.map((p) => `${p.name} (${p.user} <${p.email}>)`));
        const selected = store.personas[idx];
        applyPersona(selected);
        repoPersonas[repoPath] = {
          persona: selected.name,
          snapshot: takeSnapshot(selected),
          lastApplied: new Date().toISOString(),
        };
        saveJson(REPO_PERSONAS_FILE, repoPersonas);
        console.log(`git-personas: Switched to "${selected.name}".\n`);
      } else {
        // Check if persona has changed
        const changes = getChangedFields(persona, mapping.snapshot);
        if (changes.length > 0) {
          console.log(`\ngit-personas: ⚠️  Persona "${persona.name}" has changed since it was last applied to this repo.`);
          console.log(`  Changed fields: ${changes.join(', ')}`);
          const proceed = await ask(rl, `  Continue with updated persona "${persona.name}"? (y/N): `);
          if (proceed) {
            applyPersona(persona);
            repoPersonas[repoPath] = {
              persona: persona.name,
              snapshot: takeSnapshot(persona),
              lastApplied: new Date().toISOString(),
            };
            saveJson(REPO_PERSONAS_FILE, repoPersonas);
            console.log(`git-personas: Applied updated persona "${persona.name}".\n`);
          } else {
            const idx = await askChoice(rl, 'Select a different persona:', store.personas.map((p) => `${p.name} (${p.user} <${p.email}>)`));
            const selected = store.personas[idx];
            applyPersona(selected);
            repoPersonas[repoPath] = {
              persona: selected.name,
              snapshot: takeSnapshot(selected),
              lastApplied: new Date().toISOString(),
            };
            saveJson(REPO_PERSONAS_FILE, repoPersonas);
            console.log(`git-personas: Switched to "${selected.name}".\n`);
          }
        } else {
          // No changes — apply silently
          applyPersona(persona);
        }
      }
    } else {
      // --- No mapping for this repo ---
      if (store.personas.length === 1) {
        // Only one persona — just notify
        const persona = store.personas[0];
        console.log(`\ngit-personas: Using persona "${persona.name}" (${persona.user} <${persona.email}>)`);
        applyPersona(persona);
        repoPersonas[repoPath] = {
          persona: persona.name,
          snapshot: takeSnapshot(persona),
          lastApplied: new Date().toISOString(),
        };
        saveJson(REPO_PERSONAS_FILE, repoPersonas);
        console.log('git-personas: This persona is now saved for this repo.\n');
      } else {
        // Multiple personas — prompt to select
        console.log('\ngit-personas: No persona assigned to this repo yet.');
        const idx = await askChoice(rl, 'Select a persona:', store.personas.map((p) => `${p.name} (${p.user} <${p.email}>)`));
        const selected = store.personas[idx];
        applyPersona(selected);
        repoPersonas[repoPath] = {
          persona: selected.name,
          snapshot: takeSnapshot(selected),
          lastApplied: new Date().toISOString(),
        };
        saveJson(REPO_PERSONAS_FILE, repoPersonas);
        console.log(`git-personas: Persona "${selected.name}" saved for this repo.\n`);
      }
    }
  } finally {
    rl.close();
  }

  process.exit(0);
}

main();
