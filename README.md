<div align="center">

# 🧑‍💼 git-personas

A terminal UI for managing git personas — switch between git identities with ease.

Built with [Ink](https://github.com/vadimdemedes/ink) for a beautiful interactive CLI experience.

</div>

---

## Why?

If you work across multiple organisations, contribute to open source, or manage side projects, you probably juggle different git identities. Manually running `git config` every time is tedious and error-prone.

`git-personas` lets you define named identities and switch between them instantly — including GPG signing keys, SSH keys, and default branch preferences.

### What makes this different from just using `gitinclude`?

1. **Interactive TUI** — Create, edit, delete, and switch personas with a beautiful terminal UI (no manual config editing)
2. **Path-based auto-switch** — Automatically apply the right persona based on directory patterns (e.g., `~/work/**`, `~/personal/**`)
3. **Safety features** — `status` command shows your effective identity, `diff` compares personas, `pin` locks a persona to a specific repo
4. **Atomic writes with backups** — Your `~/.gitconfig` is never corrupted; automatic backups keep last 10 versions
5. **Sticky personas** — Hooks remember which persona you used per-repo (optional)
6. **Shell prompt integration** — See your active persona in bash/zsh/Starship prompts
7. **Full CLI toolbox** — `switch`, `list`, `status`, `diff`, `pin`, `export`, `import`, `uninstall`
8. **No manual editing** — Manage everything through the TUI or CLI commands

While `gitinclude` is just a Git feature, `git-personas` is a complete identity management layer on top.

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

Your existing git identity is automatically imported as the "default" persona on first launch.

1. Select **➕ Create Persona** to add more
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
- **Switch** between personas — uses git's native `includeIf` for non-destructive config
- **Clear** your active persona (removes managed section from global config)
- **Auto-detection** of GPG and SSH keys from your system
- **Auto-import** of existing git profile on first launch
- **📌 Sticky personas** — auto-switch identity per repo via global git hooks
- **🪝 Pre-push hook** — warns if you're pushing with a different identity than your active persona
- **📤 Export/Import** — share personas across machines
- **⚡ Headless CLI** — switch personas from the command line without the TUI
- **🖥️ Shell Prompt** — show active persona in bash, zsh, or Starship
- **🧹 Self-cleanup** — hooks remove themselves if git-personas is uninstalled
- **🗑️ Uninstall** — complete removal of all config, hooks, and shell integrations

---

## Headless CLI

In addition to the interactive TUI, you can use git-personas from the command line:

```bash
# Launch the interactive TUI (no args)
git-personas

# Switch persona without opening the TUI
git-personas switch work

# List all configured personas
git-personas list

# Show current git identity and active persona
git-personas status

# Pin a persona to the current repo (local override)
git-personas pin work

# Compare two personas
git-personas diff work personal

# Export personas to a file (or stdout)
git-personas export
git-personas export ~/my-personas.json

# Import personas from a file
git-personas import ~/my-personas.json

# Completely remove all git-personas config
git-personas uninstall

# Show help
git-personas --help
```

### CLI Commands

| Command | Description |
|---|---|
| `git-personas` | Launch the interactive TUI |
| `git-personas switch <name>` | Switch to a persona |
| `git-personas list` | List all configured personas |
| `git-personas status` | Show current git identity and active persona |
| `git-personas pin <name>` | Pin a persona to the current repo (local override) |
| `git-personas diff <a> <b>` | Compare two personas |
| `git-personas export [file]` | Export personas to JSON file or stdout |
| `git-personas import <file>` | Import personas from a JSON file |
| `git-personas uninstall` | Remove all git-personas config |
| `git-personas --help` | Show help message |

### Git Subcommand

You can also use `git-persona` (singular) which installs as a git subcommand:

```bash
# After installing, these work:
git persona switch work
git persona status
git persona list
```

This works automatically once `git-personas` is installed and on your `PATH`.

---

## Export / Import

Share personas across machines or back them up:

```bash
# Export to file
git-personas export ~/backup/personas.json

# Export to stdout (pipe to other tools)
git-personas export | jq '.[].name'

# Import from file (merges with existing personas)
git-personas import ~/backup/personas.json
```

Import skips personas with duplicate names. In a TTY, you'll be prompted to rename or skip. In non-TTY mode, duplicates are silently skipped.

---

## 📌 Sticky Personas

Sticky personas automatically manage your git identity on a per-repo basis using global git hooks.

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

This installs global hooks (pre-commit + pre-push) at `~/.config/git-personas/hooks/` and sets `core.hooksPath` in your global git config.

### Disable sticky personas

1. Run `git-personas`
2. Select **📌 Sticky Personas** from the main menu
3. Select **❌ Disable Sticky Personas**

This removes the hooks directory and unsets `core.hooksPath`.

### 🪝 Pre-push identity check

When sticky personas are enabled, a pre-push hook checks if the identity you're pushing with matches your active persona. If there's a mismatch, you'll be warned and asked to confirm before the push proceeds.

---

## 🖥️ Shell Prompt

Show your active persona in your terminal prompt. Three integrations are available:

### Bash

1. Run `git-personas`
2. Select **🖥️ Shell Prompt Integration** from the Sticky Personas menu
3. Toggle **Bash (~/.bashrc)**

This adds `source ~/.config/git-personas/git-personas.bash` to your `~/.bashrc`. The result is cached for 30 seconds to avoid reading the file on every prompt redraw.

**Note:** If you use Starship, the bash PS1 approach won't work — use the Starship integration below instead.

### Zsh

1. Run `git-personas`
2. Select **🖥️ Shell Prompt Integration** from the Sticky Personas menu
3. Toggle **Zsh (~/.zshrc)**

This adds `source ~/.config/git-personas/git-personas.zsh` to your `~/.zshrc`. Use `$(git_personas_prompt_info)` in your PROMPT. For example, with the robbyrussell theme:

```bash
PROMPT='%F{blue}%~%f $(git_personas_prompt_info)%F{yellow}%(?:→ :✗ )%f '
```

This will show `👤 persona-name` when a persona is active. The result is cached for 30 seconds. Works with or without oh-my-zsh.

### Starship

1. Run `git-personas`
2. Select **🖥️ Shell Prompt Integration** from the Sticky Personas menu
3. Toggle **⭐ Starship**

This adds a `[custom.git_persona]` module to your `~/.config/starship.toml`. It uses a fast `sed`-based extraction script (no Python or heavy dependencies) and works with any shell that uses Starship.

> **💡 Tip:** If you use Starship as your prompt, use this integration instead of Bash or Zsh — Starship takes over PS1 and the shell-specific integrations won't have any effect.

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

When you switch personas, `git-personas` writes a per-persona config file and adds an `includeIf` block to your `~/.gitconfig`:

```
# === BEGIN git-personas managed config ===
# Active persona: work
# Managed by git-personas — do not edit between markers

[includeIf "gitdir:~/"]
  path = ~/.config/git-personas/personas/work.config

# === END git-personas managed config ===
```

The per-persona config file at `~/.config/git-personas/personas/<name>.config` contains:

```
[user]
  name = Your Name
  email = you@example.com
  signingkey = <gpg key id>        (if set)

[commit]
  gpgsign = true                    (if GPG key set)

[core]
  sshCommand = ssh -i <key path>   (if SSH key set)

[init]
  defaultBranch = <branch name>     (if set)
```

> **💡 Tip:** Using `includeIf` is non-destructive — your existing `~/.gitconfig` entries outside the managed section are untouched. Per-repo overrides (set with `git config --local`) always take precedence.

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
```bash
git-personas export ~/backup/personas.json
```

### Keyboard navigation
- **↑/↓** — Navigate menu items
- **Enter** — Select
- **Esc** — Go back (on any screen, including the main menu which quits)
- In text input fields, **Enter** advances to the next step

---

## Development

```bash
# Clone the repo
git clone https://github.com/PhillOliver-Dev/git-personas.git
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
| `npm run build` | Compile TypeScript to `dist/` + copy shell scripts |
| `npm run lint` | Lint source files |
| `npm run lint:fix` | Lint and auto-fix issues |
| `npm run typecheck` | TypeScript type checking |
| `npm run check` | Typecheck + lint (runs on pre-commit) |
| `npm run prepublishOnly` | Check + build (runs automatically before publish) |

---

## How It Works

1. Persona data is stored in `~/.config/git-personas/personas.json`
2. Each persona has a config file at `~/.config/git-personas/personas/<name>.config`
3. On switch, an `includeIf` block in `~/.gitconfig` points to the active persona's config
4. GPG keys are auto-detected by running `gpg --list-keys --with-colons`
5. SSH keys are auto-detected by scanning `~/.ssh/` for `id_*` files
6. Global hooks (pre-commit + pre-push) live at `~/.config/git-personas/hooks/`

---

## Where Data Is Stored

| File | Description |
|---|---|
| `~/.config/git-personas/personas.json` | Persona definitions + active state |
| `~/.config/git-personas/personas/*.config` | Per-persona git config files |
| `~/.config/git-personas/repo-personas.json` | Repo→persona sticky mappings |
| `~/.config/git-personas/hooks/pre-commit` | Global pre-commit hook |
| `~/.config/git-personas/hooks/pre-push` | Global pre-push hook |
| `~/.config/git-personas/git-personas.bash` | Bash prompt snippet |
| `~/.config/git-personas/git-personas.zsh` | Zsh prompt snippet |
| `~/.config/git-personas/git-personas-starship.sh` | Starship persona extraction script |
| `~/.config/starship.toml` | Managed `[custom.git_persona]` section (if Starship integration enabled) |
| `~/.gitconfig` | Managed includeIf section (between markers) |

---

## 🗑️ Uninstall

Remove all git-personas configuration, hooks, and shell integrations:

```bash
git-personas uninstall
```

This removes:
- The managed section from `~/.gitconfig`
- Global git hooks and `core.hooksPath`
- Shell prompt integrations (bash, zsh, and Starship)
- The entire `~/.config/git-personas/` directory (personas, configs, hooks, scripts)

After running the uninstall command, remove the CLI itself:

```bash
npm uninstall -g git-personas
```

---

## License

MIT
