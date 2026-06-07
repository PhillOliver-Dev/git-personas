# git-personas prompt integration
#
# Shows your active git persona in the terminal prompt.
#
# --- Installation for oh-my-zsh ---
# Add to your theme file (e.g. ~/.oh-my-zsh/themes/robbyrussell.zsh-theme):
#   source ~/.config/git-personas/git-personas.zsh
#
# Or add to ~/.zshrc after oh-my-zsh is sourced:
#   source ~/.config/git-personas/git-personas.zsh
#
# --- Installation without oh-my-zsh ---
# Add to ~/.zshrc:
#   source ~/.config/git-personas/git-personas.zsh
#
# Then use $(git_personas_prompt_info) in your PROMPT:
#   PROMPT='%F{blue}%~%f $(git_personas_prompt_info)%F{yellow}%(?:→ :✗ )%f '

# Cache TTL in seconds (re-reads file after this time)
ZSH_GIT_PERSONAS_CACHE_TTL=${ZSH_GIT_PERSONAS_CACHE_TTL:-30}

# Internal: read active persona with caching
_git_personas_cached_result=""
_git_personas_cached_time=0

_git_personas_read() {
  local now
  now=$(( $(date +%s) ))

  if (( now - _git_personas_cached_time < ZSH_GIT_PERSONAS_CACHE_TTL )); then
    echo "$_git_personas_cached_result"
    return
  fi

  local config_file="${HOME}/.config/git-personas/personas.json"
  if [[ ! -f "$config_file" ]]; then
    _git_personas_cached_result=""
    _git_personas_cached_time=$now
    echo ""
    return
  fi

  # Extract the value of "active" using sed (fast, no dependencies)
  local active
  active=$(sed -n 's/.*"active"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config_file")

  _git_personas_cached_result="${active}"
  _git_personas_cached_time=$now
  echo "$active"
}

# Print the persona prompt segment
# Usage: $(git_personas_prompt_info) in your PROMPT variable
git_personas_prompt_info() {
  local persona
  persona=$(_git_personas_read)

  if [[ -n "$persona" ]]; then
    echo "%F{cyan}👤 ${persona}%f "
  else
    echo ""
  fi
}

# Clear cache (call manually if you switch personas in another terminal)
git_personas_clear_cache() {
  _git_personas_cached_result=""
  _git_personas_cached_time=0
}