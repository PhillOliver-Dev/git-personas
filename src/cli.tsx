#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import React from 'react';
import { render } from 'ink';
import type { Persona } from './store.js';
import {
  loadStore,
  saveStore,
  getPersona,
  applyPersona,
  setActive,
  clearActivePersona,
  getConfigDir,
  setRepoPersona,
  loadPathMappings,
  getEffectivePersonaForPath,
  takeSnapshot,
  getChangedFields,
} from './store.js';
import {
  uninstallStickyHooks,
  removeShellPrompt,
} from './hooks/setup.js';
import type { ShellName } from './hooks/setup.js';
import App from './index.js';

function printHelp(): void {
  console.log(`
git-personas — Manage git identities with ease

USAGE:
  git-personas                  Launch the interactive TUI
  git-personas switch <name>    Switch to a persona (headless)
  git-personas export [file]    Export personas to JSON file or stdout
  git-personas import <file>    Import personas from a JSON file
  git-personas status           Show current git identity and active persona
  git-personas list             List all personas
  git-personas pin <name>       Pin a persona to the current repo (local override)
  git-personas diff <a> <b>     Show differences between two personas
  git-personas uninstall        Remove all git-personas config, hooks, and shell integrations
  git-personas --help           Show this help message

EXAMPLES:
  git-personas switch work
  git-personas export ~/my-personas.json
  git-personas import ~/my-personas.json
  git-personas pin work
  git-personas diff work personal
  git-personas uninstall
`.trim());
}

function handleExport(filepath: string | undefined): void {
  const store = loadStore();
  const json = JSON.stringify(store.personas, null, 2);

  if (filepath) {
    try {
      fs.writeFileSync(filepath, json + '\n');
      console.log(`Exported ${store.personas.length} persona(s) to ${filepath}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Error writing to file: ${msg}`);
      process.exit(1);
    }
  } else {
    process.stdout.write(json + '\n');
  }

  process.exit(0);
}

async function handleImport(filepath: string | undefined): Promise<void> {
  if (!filepath) {
    console.error('Error: Import requires a file path');
    console.error('Usage: git-personas import <filepath>');
    process.exit(1);
  }

  const store = loadStore();

  let data: string;
  try {
    data = fs.readFileSync(filepath, 'utf-8');
  } catch {
    console.error(`Error: Cannot read file "${filepath}"`);
    process.exit(1);
  }

  let imported: Persona[];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected an array');
    }
    imported = parsed as Persona[];
  } catch {
    console.error('Error: Import file must contain a JSON array of personas');
    process.exit(1);
  }

  const isTTY = process.stdout.isTTY;
  const rl = isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl!.question(question, (answer: string) => {
        resolve(answer.trim());
      });
    });
  };

  let importCount = 0;
  let skipCount = 0;
  const existingNames = new Set(store.personas.map((p) => p.name));

  for (const persona of imported) {
    if (existingNames.has(persona.name)) {
      skipCount++;
      if (isTTY && rl) {
        console.log(`\nWarning: Persona "${persona.name}" already exists.`);
        const newName = await ask('Enter new name (or press Enter to skip): ');
        if (newName) {
          store.personas.push({ ...persona, name: newName });
          existingNames.add(newName);
          importCount++;
          skipCount--;
        }
      } else {
        console.warn(`Skipping "${persona.name}" — already exists`);
      }
    } else {
      store.personas.push(persona);
      existingNames.add(persona.name);
      importCount++;
    }
  }

  if (rl) {
    rl.close();
  }

  saveStore(store);

  const summary = `Imported ${importCount} persona${importCount !== 1 ? 's' : ''}`;
  console.log(skipCount > 0 ? `${summary}, skipped ${skipCount}` : summary);
  process.exit(0);
}

function handleSwitch(personaName: string | undefined): void {
  if (!personaName) {
    console.error('Error: switch requires a persona name');
    console.error('Usage: git-personas switch <persona-name>');
    process.exit(1);
  }

  const store = loadStore();
  const persona = getPersona(personaName, store);

  if (!persona) {
    console.error(`Error: Persona "${personaName}" not found`);
    console.error(`Available personas: ${store.personas.map((p) => p.name).join(', ') || '(none)'}`);
    process.exit(1);
  }

  applyPersona(persona);
  const updated = setActive(personaName, store);
  saveStore(updated);
  console.log(`Switched to persona "${personaName}" (${persona.user} <${persona.email}>)`);
  process.exit(0);
}

function handleStatus(): void {
  const store = loadStore();

  // Get effective git config (includes includeIf values)
  let effectiveUser: string | undefined;
  let effectiveEmail: string | undefined;
  let effectiveGpgKey: string | undefined;
  let effectiveSshKey: string | undefined;
  let effectiveDefaultBranch: string | undefined;

  try {
    effectiveUser = execSync('git config user.name', { encoding: 'utf-8' }).trim();
  } catch {
    // Not set
  }
  try {
    effectiveEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim();
  } catch {
    // Not set
  }
  try {
    effectiveGpgKey = execSync('git config user.signingkey', { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    // Not set
  }
  try {
    const sshCmd = execSync('git config core.sshCommand', { encoding: 'utf-8' }).trim();
    const match = sshCmd.match(/-i\s+(\S+)/);
    if (match) effectiveSshKey = match[1];
  } catch {
    // Not set
  }
  try {
    effectiveDefaultBranch = execSync('git config init.defaultBranch', { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    // Not set
  }

  // Check current repo
  let repoPath: string | undefined;
  try {
    repoPath = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    // Not in a git repo
  }

  // Check path mappings
  const pathMappings = loadPathMappings();
  const pathPersona = repoPath ? getEffectivePersonaForPath(repoPath, pathMappings) : null;

  console.log('Current git identity:');
  console.log(`  user.name:    ${effectiveUser || '(not set)'}`);
  console.log(`  user.email:   ${effectiveEmail || '(not set)'}`);
  if (effectiveGpgKey) console.log(`  signingkey:   ${effectiveGpgKey}`);
  if (effectiveSshKey) console.log(`  sshCommand:   ssh -i ${effectiveSshKey}`);
  if (effectiveDefaultBranch) console.log(`  defaultBranch: ${effectiveDefaultBranch}`);

  console.log(`\nActive persona: ${store.active ? store.active : '(none)'}`);

  if (repoPath) {
    console.log(`\nCurrent repo: ${repoPath}`);
    if (pathPersona) {
      console.log(`  Path-based persona: ${pathPersona}`);
    }
  }

  if (pathMappings.length > 0) {
    console.log(`\nPath mappings (${pathMappings.length}):`);
    for (const mapping of pathMappings) {
      console.log(`  ${mapping.path} → ${mapping.persona}`);
    }
  }

  process.exit(0);
}

function handleList(): void {
  const store = loadStore();

  if (store.personas.length === 0) {
    console.log('No personas configured.');
    process.exit(0);
  }

  console.log(`Personas (${store.personas.length}):`);
  for (const persona of store.personas) {
    const isActive = persona.name === store.active;
    const marker = isActive ? ' (active)' : '';
    console.log(`  ${persona.name}${marker}`);
    console.log(`    ${persona.user} <${persona.email}>`);
    if (persona.gpgKey) console.log(`    GPG: ${persona.gpgKey}`);
    if (persona.sshKey) console.log(`    SSH: ${persona.sshKey}`);
    if (persona.defaultBranch) console.log(`    defaultBranch: ${persona.defaultBranch}`);
    console.log('');
  }

  process.exit(0);
}

function handlePin(personaName: string | undefined): void {
  if (!personaName) {
    console.error('Error: pin requires a persona name');
    console.error('Usage: git-personas pin <persona-name>');
    process.exit(1);
  }

  let repoPath: string;
  try {
    repoPath = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('Error: Not inside a git repository');
    process.exit(1);
  }

  const store = loadStore();
  const persona = getPersona(personaName, store);

  if (!persona) {
    console.error(`Error: Persona "${personaName}" not found`);
    console.error(`Available personas: ${store.personas.map((p) => p.name).join(', ') || '(none)'}`);
    process.exit(1);
  }

  // Write persona config file
  const configPath = `${getConfigDir()}/personas/${persona.name}.config`;
  const lines: string[] = [];
  lines.push('[user]');
  lines.push(`\tname = ${persona.user}`);
  lines.push(`\temail = ${persona.email}`);
  if (persona.gpgKey) {
    lines.push(`\tsigningkey = ${persona.gpgKey}`);
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
  fs.writeFileSync(configPath, lines.join('\n') + '\n');

  // Write to local git config
  try {
    execSync(`git config --local include.path ${configPath}`, { stdio: 'pipe' });
    console.log(`Pinned persona "${personaName}" to this repo.`);
    console.log(`  This repo will now always use: ${persona.user} <${persona.email}>`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Also save to repo personas for sticky mode
  setRepoPersona(repoPath, persona);

  process.exit(0);
}

function handleDiff(nameA: string | undefined, nameB: string | undefined): void {
  if (!nameA || !nameB) {
    console.error('Error: diff requires two persona names');
    console.error('Usage: git-personas diff <persona-a> <persona-b>');
    process.exit(1);
  }

  const store = loadStore();
  const personaA = getPersona(nameA, store);
  const personaB = getPersona(nameB, store);

  if (!personaA) {
    console.error(`Error: Persona "${nameA}" not found`);
    process.exit(1);
  }
  if (!personaB) {
    console.error(`Error: Persona "${nameB}" not found`);
    process.exit(1);
  }

  const snapshotA = takeSnapshot(personaA);
  const changes = getChangedFields(personaB, snapshotA);

  console.log(`Comparing "${nameA}" vs "${nameB}":`);

  if (changes.length === 0) {
    console.log('  (identical)');
  } else {
    console.log(`  Different fields: ${changes.join(', ')}`);
    console.log('');
    console.log(`${nameA}:`);
    console.log(`    user.name:    ${personaA.user}`);
    console.log(`    user.email:   ${personaA.email}`);
    if (personaA.gpgKey) console.log(`    signingkey:   ${personaA.gpgKey}`);
    if (personaA.sshKey) console.log(`    sshCommand:   ssh -i ${personaA.sshKey}`);
    if (personaA.defaultBranch) console.log(`    defaultBranch: ${personaA.defaultBranch}`);
    console.log('');
    console.log(`${nameB}:`);
    console.log(`    user.name:    ${personaB.user}`);
    console.log(`    user.email:   ${personaB.email}`);
    if (personaB.gpgKey) console.log(`    signingkey:   ${personaB.gpgKey}`);
    if (personaB.sshKey) console.log(`    sshCommand:   ssh -i ${personaB.sshKey}`);
    if (personaB.defaultBranch) console.log(`    defaultBranch: ${personaB.defaultBranch}`);
  }

  process.exit(0);
}

function handleUninstall(): void {
  // 1. Remove managed section from ~/.gitconfig
  clearActivePersona();
  console.log('✓ Removed git-personas section from ~/.gitconfig');

  // 2. Remove sticky hooks and core.hooksPath
  uninstallStickyHooks();
  console.log('✓ Removed global git hooks');

  // 3. Remove shell prompt integrations
  for (const shell of ['bash', 'zsh', 'starship'] as ShellName[]) {
    try {
      removeShellPrompt(shell);
    } catch {
      // Not installed for this shell — skip
    }
  }
  console.log('✓ Removed shell prompt integrations');

  // 4. Remove the entire config directory
  try {
    fs.rmSync(getConfigDir(), { recursive: true, force: true });
    console.log('✓ Removed ~/.config/git-personas/');
  } catch {
    // Already gone
  }

  console.log('\ngit-personas has been completely uninstalled.');
  console.log('Run "npm uninstall -g git-personas" to remove the CLI.');
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'export') {
    handleExport(args[1]);
    return;
  }

  if (command === 'import') {
    await handleImport(args[1]);
    return;
  }

  if (command === 'switch') {
    handleSwitch(args[1]);
    return;
  }

  if (command === 'status') {
    handleStatus();
    return;
  }

  if (command === 'list') {
    handleList();
    return;
  }

  if (command === 'pin') {
    handlePin(args[1]);
    return;
  }

  if (command === 'diff') {
    handleDiff(args[1], args[2]);
    return;
  }

  if (command === 'uninstall') {
    handleUninstall();
    return;
  }

  // Launch TUI
  const { waitUntilExit, clear } = render(React.createElement(App));
  await waitUntilExit();
  clear();
}

main();