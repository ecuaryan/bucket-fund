#!/usr/bin/env bash
# Load local Supabase vars into your current shell.
#
#   source scripts/env-local.sh
#
# Do NOT use: eval "$(npm run env:local)" — npm prints extra lines that break eval.
# Alternatively: eval "$(node scripts/supabase-env.mjs)"

# BASH_SOURCE works in bash; zsh needs (%):-%x when sourced.
if [ -n "${BASH_SOURCE[0]+x}" ]; then
  _SCRIPT="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
  _SCRIPT="${(%):-%x}"
else
  _SCRIPT="$0"
fi
_ROOT="$(cd "$(dirname "$_SCRIPT")/.." && pwd)"

if ! _out="$(node "$_ROOT/scripts/supabase-env.mjs" 2>&1)"; then
  echo "$_out" >&2
  return 1 2>/dev/null || exit 1
fi

eval "$_out"
