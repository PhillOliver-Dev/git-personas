#!/usr/bin/env node

/**
 * git-personas pre-push hook
 *
 * Warns before pushing if the current git identity doesn't match the active persona.
 * - Non-TTY: silently skip (never blocks CI/automated pushes)
 * - Self-cleanup if git-personas package is removed
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import readline from 'node:readline';

// --- Config paths ---
const CONFIG_DIR = `${os.homedir()}/.config/git-personas`;
const PERSONAS_FILE = `${CONFIG_DIR}/personas.json`;
const HOOKS_DIR = `${CONFIG_DIR}/hooks`;

// --- Helpers ---
function loadJson<T>(path: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function isPackageInstalled(): boolean {
  try {
    execSync('command -v git-personas', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function cleanupHooks(): void {
  try {
    fs.rmSync(HOOKS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
  try {
    execSync('git config --global --unset core.hooksPath', { stdio: 'pipe' });
  } catch {
    // Already unset
  }
  console.log('git-personas: Package no longer installed. Global git hooks cleaned up.');
}

function ask(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// --- Types ---
interface PersonaStore {
  personas: { name: string; user: string; email: string }[];
  active: string | null;
}

// --- Main ---
async function main(): Promise<void> {
  // Non-TTY — silently skip
  if (!process.stdout.isTTY) {
    process.exit(0);
  }

  // Check if git-personas is still installed — self-cleanup if not
  if (!isPackageInstalled()) {
    cleanupHooks();
    process.exit(0);
  }

  // Load personas
  const store = loadJson<PersonaStore>(PERSONAS_FILE);
  if (!store || !store.active || !store.personas) {
    process.exit(0);
  }

  const activePersona = store.personas.find((p) => p.name === store.active);
  if (!activePersona) {
    process.exit(0);
  }

  // Read current git identity
  let currentUser: string;
  let currentEmail: string;
  try {
    currentUser = execSync('git config user.name', { encoding: 'utf-8' }).trim();
    currentEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim();
  } catch {
    process.exit(0);
  }

  // Check if current identity matches active persona
  if (currentUser === activePersona.user && currentEmail === activePersona.email) {
    process.exit(0);
  }

  // Mismatch — warn the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(`\ngit-personas: ⚠️  Identity mismatch!`);
    console.log(`  Active persona: "${activePersona.name}" (${activePersona.user} <${activePersona.email}>)`);
    console.log(`  Current identity: (${currentUser} <${currentEmail}>)`);
    console.log(`  You're about to push with a different identity than your active persona.`);

    const proceed = await ask(rl, '  Push anyway? (y/N): ');
    if (!proceed) {
      console.log('git-personas: Push cancelled.');
      process.exit(1);
    }

    console.log('git-personas: Proceeding with push...\n');
  } finally {
    rl.close();
  }

  process.exit(0);
}

main();
