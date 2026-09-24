#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale o Node.js 18+ antes de continuar."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm não encontrado. Verifique a instalação do Node.js."
  exit 1
fi

printf '\n==> Instalando dependências da raiz...\n'
npm install

printf '\n==> Instalando dependências do backend...\n'
npm install --prefix backend

printf '\n==> Instalando dependências do frontend...\n'
npm install --prefix frontend

printf '\n==> Verificação final...\n'
if [ -d "$ROOT_DIR/backend/node_modules" ] && [ -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "Dependências instaladas com sucesso."
else
  echo "Alguma dependência não foi instalada corretamente."
  exit 1
fi

printf '\nPróximo passo:\n'
printf '  - Rodar o backend: npm run dev --prefix backend\n'
printf '  - Rodar o frontend: npm run dev --prefix frontend\n'
printf '  - Ou rodar tudo junto: npm run dev\n'
