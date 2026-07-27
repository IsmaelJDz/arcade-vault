#!/usr/bin/env bash
# PostToolUse hook: formatea con Prettier y ESLint --fix el archivo creado/editado.
# Recibe JSON en stdin (.tool_input.file_path). No bloquea nunca (exit 0).
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input.file_path||"")}catch{process.stdout.write("")}})')

# Sin ruta o el archivo ya no existe -> nada que hacer.
{ [ -z "$file" ] || [ ! -f "$file" ]; } && exit 0

BIN="${CLAUDE_PROJECT_DIR:-$(pwd)}/node_modules/.bin"

# Prettier: --ignore-unknown salta extensiones sin parser (cubre "cualquier archivo").
[ -x "$BIN/prettier" ] && "$BIN/prettier" --write --ignore-unknown "$file" >/dev/null 2>&1 || true

# ESLint --fix solo para JS/TS.
case "$file" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx)
    [ -x "$BIN/eslint" ] && "$BIN/eslint" --fix "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
