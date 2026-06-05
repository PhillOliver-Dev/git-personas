<div align="center">

# 🧑‍💼 git-personas

A terminal UI for managing git personas — switch between git identities with ease.

Built with [Ink](https://github.com/vadimdemedes/ink) for a beautiful interactive CLI experience.

</div>

---

## Why?

If you work across multiple organisations, contribute to open source, or manage side projects, you probably juggle different git identities. Manually running `git config` every time is tedious and error-prone.

`git-personas` lets you define named identities and switch between them instantly — including GPG signing keys, SSH keys, and default branch preferences.

---

## Install

```bash
npm install -g git-personas
```

**Requirements:** Node.js 18+

---

## Quick Start

```bash
git-personas
```

You'll see the main menu with all your personas listed and the currently active one highlighted.

### First time?

1. Select **➕ Create Persona**
2. Fill in a name (e.g. `work`, `personal`, `opensource`)
3. Enter your git user name and email
4. Optionally pick a GPG signing key (auto-detected from your system)
5. Optionally pick an SSH key (auto-detected from `~/.ssh`)
6. Optionally set a default branch name (e.g. `main`)
7. Confirm and you're done

Then switch to it with **🔄 Switch Persona**.

---

## Features

- **Create** personas with name, email, GPG key, SSH key, and default branch
- **Edit** any field on an existing persona
- **Delete** personas you no longer need
- **Switch** between personas — instantly updates your global `~/.gitconfig`
- **Clear** your active persona (removes all git identity from global config)
- **Auto-detection** of GPG and SSH keys from your system
- **📌 Sticky personas** — auto-switch identity per repo via global git hooks

---

## 📌 Sticky Personas

Sticky personas automatically manage your git identity on a per-repo basis using a global pre-commit hook.

### How it works

1. **First commit in a repo** — you're prompted to select which persona to use
2. **Returning to a repo** — your saved persona is applied automatically, no prompts
3. **Persona changed since last use** — you get a warning with the changed fields and must confirm
4. **Only one persona** — auto-applied with a notification, no interaction needed
5. **Non-TTY contexts** (CI, IDEs, editors) — silently skipped, never blocks your workflow

### Enable sticky personas

1. Run `git-personas`
2. Select **📌 Sticky Personas** from the main menu
3. Select **✅ Enable Sticky Personas**

This installs a global pre-commit hook at `~/.config/git-personas/hooks/` and sets `core.hooksPath` in your global git config.

### Disable sticky personas

1. Run `git-personas`
2. Select **📌 Sticky Personas** from the main menu
3. Select **❌ Disable Sticky Personas**

This removes the hooks directory and unsets `core.hooksPath`.

### Where data is stored

- Persona config: `~/.config/git-personas/personas.json`
- Repo→persona mapping: `~/.config/git-personas/repo-personas.json`
- Hook script: `~/.config/git-personas/hooks/pre-commit`

---

## Persona Fields

| Field | Required | Description |
|---|---|---|
| **Name** | ✅ | Identifier for the persona (e.g. `work`, `personal`) |
| **User** | ✅ | Git `user.name` — your display name in commits |
| **Email** | ✅ | Git `user.email` — your email in commits |
| **GPG Key** | ❌ | Signing key for verified commits (picked from auto-detected list) |
| **SSH Key** | ❌ | SSH identity for git over SSH (picked from auto-detected list) |
| **Default Branch** | ❌ | Sets `init.defaultBranch` (e.g. `main`, `develop`) |

---

## What Gets Changed?

When you switch personas, `git-personas` updates your **global** `~/.gitconfig`:

```
user.name          → "Your Name"
user.email         → "you@example.com"
user.signingkey    → <gpg key id>       (if set)
commit.gpgsign     → true               (if GPG key set)
core.sshCommand    → ssh -i <key path>  (if SSH key set)
init.defaultBranch → <branch name>       (if set)
```

Fields that aren't set on the persona are **unset** from global config when you switch.

> **💡 Tip:** This only affects global config. Per-repo overrides (set with `git config --local`) always take precedence.

---

## Usage Tips

### Per-repo overrides
If you need a specific repo to always use a certain identity regardless of your active persona, use local config:
```bash
git config --local user.email "special@example.com"
```
Local config always wins over global.

### Keep your GPG key tidy
When setting up GPG signing, make sure your GPG key's email matches the email in your persona. Otherwise GitHub/GitLab won't show the verified badge on your commits.

### SSH key per organisation
If different organisations require different SSH keys, add the SSH key to each persona. `git-personas` sets `core.sshCommand` to route SSH through the right key automatically.

### Quick check which persona is active
Run `git-personas` — the main screen shows your active persona with a 🟢 indicator. Or check directly:
```bash
git config --global user.name && git config --global user.email
```

### Backing up your personas
Persona data lives at `~/.config/git-personas/personas.json`. Back this up or dotfile it to keep your personas across machines.

### Keyboard navigation
- **↑/↓** — Navigate menu items
- **Enter** — Select
- **Esc** — Go back (on any screen, including the main menu which quits)
- In text input fields, **Enter** advances to the next step

---

## Development

```bash
# Clone the repo
git clone https://github.com/<your-username>/git-personas.git
cd git-personas

# Install dependencies
npm install

# Run in dev mode
npm run dev

# Typecheck
npm run typecheck

# Lint
npm run lint

# Lint + typecheck
npm run check

# Build
npm run build
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Run in development mode with tsx |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | Lint source files |
| `npm run lint:fix` | Lint and auto-fix issues |
| `npm run typecheck` | TypeScript type checking |
| `npm run check` | Typecheck + lint (runs on pre-commit) |
| `npm run prepublishOnly` | Check + build (runs automatically before publish) |

---

## How It Works

1. Persona data is stored in `~/.config/git-personas/personas.json`
2. On switch, global `~/.gitconfig` is updated via `git config --global`
3. GPG keys are auto-detected by running `gpg --list-keys --with-colons`
4. SSH keys are auto-detected by scanning `~/.ssh/` for `id_*` files

---

## License

MIT
