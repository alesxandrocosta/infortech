#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute este script como root ou com sudo."
  exit 1
fi

REPO_DIR="${1:-$(pwd)}"
if [ ! -f "$REPO_DIR/package.json" ]; then
  echo "Diretório do projeto inválido: $REPO_DIR"
  echo "Use: sudo bash ./scripts/provision-vps.sh /caminho/do/projeto"
  exit 1
fi

cd "$REPO_DIR"

DB_NAME="${DB_NAME:-bd_infortec}"
DB_USER="${DB_USER:-infortec_app}"
DB_PASSWORD="${DB_PASSWORD:-InFortec!2026}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-InFortecRoot!2026}"
NODE_MAJOR="${NODE_MAJOR:-20}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | cut -d' ' -f1)}"
NODE_ENV="${NODE_ENV:-production}"
BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:${FRONTEND_PORT}}"

export DEBIAN_FRONTEND=noninteractive

echo "========================================"
echo "Preparando servidor VPS para o TechFlow ERP"
echo "========================================"

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  git \
  build-essential \
  unzip \
  software-properties-common \
  mysql-server \
  mysql-client \
  ufw

curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
apt-get install -y --no-install-recommends nodejs
npm install -g npm@latest pm2

systemctl enable --now mysql

if ! mysql -uroot -e "SELECT 1" >/dev/null 2>&1; then
  mysqladmin -u root password "$MYSQL_ROOT_PASSWORD"
fi

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_ROOT_PASSWORD'; FLUSH PRIVILEGES;" >/dev/null 2>&1 || true
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \
  \\`$DB_NAME\\`;" >/dev/null 2>&1
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" >/dev/null 2>&1
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON \
  \\`$DB_NAME\\`.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;" >/dev/null 2>&1

cat > "$REPO_DIR/backend/.env" <<EOF
DB_HOST=localhost
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_PORT=3306
DB_NAME=${DB_NAME}
NODE_ENV=${NODE_ENV}
PORT=${BACKEND_PORT}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d
CORS_ORIGIN=${CORS_ORIGIN}
LABEL_OUTPUT_DIR=/tmp/etiquetas
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
SALES_TAX_RATE=0.0865
TZ=America/Sao_Paulo
OAUTH_REDIRECT_BASE_URL=http://localhost:${BACKEND_PORT}
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
ADMIN_FULL_NAME=
ADMIN_USERNAME=
ADMIN_EMAIL=
ADMIN_PHONE=
ADMIN_PASSWORD=
EOF

cat > "$REPO_DIR/frontend/.env" <<EOF
VITE_API_URL=http://localhost:${BACKEND_PORT}
VITE_APP_NAME=TechFlow ERP
EOF

cd "$REPO_DIR"

npm install --include=dev
npm install --prefix backend --include=dev
npm install --prefix frontend --include=dev

npm run build --prefix frontend

if [ -f "$REPO_DIR/backend/scripts/init-database.js" ]; then
  npm run init-db --prefix backend
fi

mkdir -p "$REPO_DIR/backend/uploads" "$REPO_DIR/backend/logs" /tmp/etiquetas

cat > "$REPO_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'infortec-backend',
      cwd: './backend',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '${BACKEND_PORT}'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M'
    },
    {
      name: 'infortec-frontend',
      cwd: './frontend',
      script: 'npx',
      args: ['vite', 'preview', '--host', '0.0.0.0', '--port', '${FRONTEND_PORT}'],
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
EOF

pm2 delete all >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow "OpenSSH" >/dev/null 2>&1 || true
ufw --force enable

cat <<EOT

========================================
Ambiente pronto para produção.
========================================

Banco:
- Host: localhost
- Banco: ${DB_NAME}
- Usuário: ${DB_USER}
- Senha: ${DB_PASSWORD}

Backend:
- URL: http://localhost:${BACKEND_PORT}
- Env: ${REPO_DIR}/backend/.env

Frontend:
- URL: http://localhost:${FRONTEND_PORT}
- Build gerado em: ${REPO_DIR}/frontend/dist

Comandos úteis:
- pm2 status
- pm2 logs infortec-backend
- pm2 logs infortec-frontend
- npm run dev --prefix backend
- npm run dev --prefix frontend

Dica de produção:
- configure CORS_ORIGIN com seu domínio real, ex.: https://seu-dominio.com
- use um proxy reverso (Nginx/Traefik) para expor o frontend e API na internet
EOT
