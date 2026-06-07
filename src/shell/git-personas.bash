# git-personas prompt integration for bash
#
# Shows your active git persona in the terminal prompt.
#
# --- Installation ---
# Add to ~/.bashrc:
#   source ~/.config/git-personas/git-personas.bash
#
# Then use $(git_personas_prompt_info) in your PS1:
#   PS1='\[\033[34m\]\w\[\033[0m\] $(git_personas_prompt_info)\[\033[33m\]$\[\033[0m\] '
#
# --- Usage ---
# The result is cached for 30 seconds to avoid reading the file on every prompt.

GIT_PERSONAS_CACHE_TTL=${GIT_PERSONAS_CACHE_TTL:-30}
_git_personas_cached_result=""
_git_personas_cached_time=0

_git_personas_read() {
  local now
  now=$(date +%s)

  if (( now - _git_personas_cached_time < GIT_PERSONAS_CACHE_TTL )); then
    printf '%s' "$_git_personas_cached_result"
    return
  fi

  local config_file="${HOME}/.config/git-personas/personas.json"
  if [[ ! -f "$config_file" ]]; then
    _git_personas_cached_result=""
    _git_personas_cached_time=$now
    printf ''
    return
  fi

  # Extract the value of "active" using sed (fast, no dependencies)
  local active
  active=$(sed -n 's/.*"active"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$config_file")

  _git_personas_cached_result="${active}"
  _git_personas_cached_time=$now
  printf '%s' "$active"
}

# Print the persona prompt segment
# Usage: $(git_personas_prompt_info) in your PS1
git_personas_prompt_info() {
  local persona
  persona=$(_git_personas_read)

  if [[ -n "$persona" ]]; then
    printf '\033[36m👤 %s\033[0m ' "$persona"
  else
    printf ''
  fi
}

# Clear cache (call manually if you switch personas in another terminal)
git_personas_clear_cache() {
  _git_personas_cached_result=""
  _git_personas_cached_time=0
}

# Automatically append to PS1 if not already there
if [[ -n "${PS1}" && "${PS1}" != *"git_personas_prompt_info"* ]]; then
  PS1="${PS1}\$(git_personas_prompt_info)"
fi