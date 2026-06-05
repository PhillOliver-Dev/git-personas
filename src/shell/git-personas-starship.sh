#!/usr/bin/env bash
# git-personas prompt integration for Starship
#
# Fast extraction of active persona name using sed (no Python).
# Used by Starship's [custom.git_persona] module.
#
# Output: persona name (e.g. "work") or nothing if none active.

config_file="${HOME}/.config/git-personas/personas.json"
[[ -f "$config_file" ]] || exit 0

# Extract the value of "active" from the JSON — one sed process, no forks
sed -n 's/.*"active"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config_file"
