#!/usr/bin/env node

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
} from './store.js';
import App from './index.js';

function printHelp(): void {
  console.log(`
git-personas — Manage git identities with ease

USAGE:
  git-personas                  Launch the interactive TUI
  git-personas switch <name>    Switch to a persona (headless)
  git-personas export [file]    Export personas to JSON file or stdout
  git-personas import <file>    Import personas from a JSON file
  git-personas --help           Show this help message

EXAMPLES:
  git-personas switch work
  git-personas export ~/my-personas.json
  git-personas import ~/my-personas.json
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

  // Launch TUI
  const { waitUntilExit, clear } = render(React.createElement(App));
  await waitUntilExit();
  clear();
}

main();
