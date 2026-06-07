#!/usr/bin/env node

/**
 * Global pre-commit hook that remembers which persona was used per repo.
 * Auto-applies that persona when returning to the repo.
 *
 * Non-blocking behaviour:
 * - In non-TTY contexts, silently skips prompts
 * - Only one persona → auto-apply without prompt
 * - Multiple personas → prompt with current persona pre-selected
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

// Import from git-personas lib modules
import { readGitConfig } from '../lib/git.js';
import {
  loadRepoPersonas,
  saveRepoPersonas,
  PERSONAS_FILE,
  CONFIG_DIR,
} from '../store.js';
import {
  loadPathMappings,
  getEffectivePersonaForPath,
} from '../store.js';
import {
  writeManagedSection,
} from '../lib/gitconfig.js';
import {
  configFileName,
} from '../lib/persona-config.js';
import {
  PERSONAS_CONFIG_DIR,
} from '../lib/paths.js';
import {
  takeSnapshot,
  getChangedFields,
} from '../lib/snapshot.js';

import type { Persona } from '../store.js';
import type { RepoPersonaMapping, PathMapping } from '../store.js';

type RepoPersonas = Record<string, RepoPersonaMapping>;
type PathMappings = PathMapping[];

// Find git repo root
let repoRoot: string | null = null;
try {
  const gitDir = process.env.GIT_DIR;
  if (gitDir) {
    // If GIT_DIR is set, use it to find the repo root
    repoRoot = fs.realpathSync(gitDir).replace(/\.git$/, '');
  } else {
    // Otherwise, use git rev-parse
    const child = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' });
    repoRoot = child.trim();
  }
} catch {
  // Not in a git repo
}

if (!repoRoot) {
  process.exit(0);
}

// Check if we should interact with the user
const isTTY = process.stdout.isTTY && process.stdin.isTTY;

function loadPersonas(): Persona[] {
  try {
    const data = fs.readFileSync(PERSONAS_FILE, 'utf-8');
    const store = JSON.parse(data);
    return store.personas || [];
  } catch {
    return [];
  }
}

function loadPersona(name: string): Persona | undefined {
  const personas = loadPersonas();
  return personas.find((p) => p.name === name);
}

function writePersonaConfigFile(name: string, persona: Persona): void {
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
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.mkdirSync(PERSONAS_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(configPath, lines.join('\n') + '\n');
}

function applyPersona(persona: Persona): void {
  writePersonaConfigFile(persona.name, persona);
  writeManagedSection({ activePersona: persona.name });
}

function askUser(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectPersona(promptMessage: string, _preselect?: string): Promise<Persona | null> {
  const personas = loadPersonas();

  if (personas.length === 0) {
    console.error('No personas configured. Run `git-personas` to create one.');
    return null;
  }

  if (personas.length === 1) {
    // Auto-apply the only persona
    const persona = personas[0];
    applyPersona(persona);
    console.log(`Using persona "${persona.name}" (${persona.user} <${persona.email}>)`);
    return persona;
  }

  // Multiple personas - prompt
  console.log(promptMessage);
  const activePersonaName = readGitConfig('git-personas.active');
  personas.forEach((p, i: number) => {
    const marker = p.name === activePersonaName ? ' (active)' : '';
    console.log(`  [${i + 1}] ${p.name}${marker} — ${p.user} <${p.email}>`);
  });

  const answer = await askUser(`Select persona [1-${personas.length}]: `);
  const index = parseInt(answer, 10) - 1;

  if (isNaN(index) || index < 0 || index >= personas.length) {
    console.error('Invalid selection. Skipping...');
    return null;
  }

  return personas[index];
}

// Main execution
(async () => {
  const repoPersonas: RepoPersonas = loadRepoPersonas();
  const existing = repoPersonas[repoRoot!];

  // Check if path mappings define an auto-persona
  const mappings: PathMappings = loadPathMappings();
  const pathPersona = getEffectivePersonaForPath(repoRoot!, mappings);

  // If a path persona is set, use it and skip prompts
  if (pathPersona) {
    const persona = loadPersona(pathPersona);
    if (persona) {
      const currentSnapshot = takeSnapshot(persona);

      if (!existing) {
        // First time with this path persona
        applyPersona(persona);
        repoPersonas[repoRoot!] = {
          persona: persona.name,
          snapshot: currentSnapshot,
          lastApplied: new Date().toISOString(),
        };
        saveRepoPersonas(repoPersonas);
        console.log(`Applied path-based persona "${persona.name}" (${persona.user} <${persona.email}>)`);
      } else if (persona.name !== existing.persona) {
        // Path persona changed - ask to confirm
        if (isTTY) {
          const changes = getChangedFields(currentSnapshot, existing.snapshot);
          console.log(`\n⚠️  Path-based persona changed for this repo`);
          console.log(`   Was: ${existing.persona}`);
          console.log(`   Now: ${persona.name}`);
          console.log(`   Changed: ${changes.join(', ')}`);

          const answer = await askUser('Apply new persona? (y/N): ');
          if (answer.toLowerCase() === 'y') {
            applyPersona(persona);
            repoPersonas[repoRoot!] = {
              persona: persona.name,
              snapshot: currentSnapshot,
              lastApplied: new Date().toISOString(),
            };
            saveRepoPersonas(repoPersonas);
            console.log(`Applied persona "${persona.name}"`);
          } else {
            // User declined - restore old persona
            const oldPersona = loadPersona(existing.persona);
            if (oldPersona) {
              applyPersona(oldPersona);
            }
          }
        } else {
          // Non-TTY - silently apply the path persona
          applyPersona(persona);
        }
      }
    }
    process.exit(0);
  }

  // No path mapping - check if we have a saved repo persona
  if (existing) {
    const persona = loadPersona(existing.persona);
    if (persona) {
      applyPersona(persona);
      // No output - user already chose this persona previously
    }
    process.exit(0);
  }

  // First time - prompt for persona
  if (!isTTY) {
    // Non-TTY - skip
    process.exit(0);
  }

  console.log(`\n📌 First commit in repo: ${repoRoot}`);
  const persona = await selectPersona('Which persona should be used for this repo?');

  if (!persona) {
    process.exit(0);
  }

  applyPersona(persona);
  repoPersonas[repoRoot!] = {
    persona: persona.name,
    snapshot: takeSnapshot(persona),
    lastApplied: new Date().toISOString(),
  };
  saveRepoPersonas(repoPersonas);
})();