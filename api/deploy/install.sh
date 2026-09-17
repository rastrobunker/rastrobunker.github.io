#!/usr/bin/env bash
# Deploys the Rastro Bunker API (Nuxt/Nitro backend) on an Amazon Linux EC2 instance:
#   - installs Node.js 20 and nginx (dnf on Amazon Linux 2023, yum+amazon-linux-extras on Amazon Linux 2)
#   - builds the app and installs it as a systemd service that starts on boot and restarts on failure
#   - loads api/.env as the service's environment (EnvironmentFile), so DATABASE_URL/ADMIN_CODE/etc.
#     become real Linux environment variables for the process
#   - configures nginx as a reverse proxy from port 80 to the Nitro server on 127.0.0.1:3000
#
# Usage (run as root or with sudo on the EC2 instance, from inside the `api` directory):
#   sudo ./deploy/install.sh
#
# Optional environment variables to override defaults:
#   APP_DIR=/opt/rastro-bunker/api SERVICE_USER=rastrobunker PORT=3000 SERVER_NAME=_ sudo -E ./deploy/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"   # .../api

APP_DIR="${APP_DIR:-/opt/rastro-bunker/api}"
SERVICE_USER="${SERVICE_USER:-rastrobunker}"
PORT="${PORT:-3000}"
SERVER_NAME="${SERVER_NAME:-_}"
SERVICE_NAME="rastro-bunker-api"

log() { echo -e "\n==> $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Este script debe ejecutarse como root (usa sudo)." >&2
  exit 1
fi

# ---------- 1. Instalar Node.js y nginx ----------
log "Instalando Node.js 20 y nginx..."
if command -v dnf >/dev/null 2>&1; then
  # Amazon Linux 2023
  dnf install -y nodejs20 nginx git >/dev/null 2>&1 || dnf install -y nodejs nginx git
  command -v node >/dev/null 2>&1 || dnf install -y nodejs20-npm
elif command -v yum >/dev/null 2>&1; then
  # Amazon Linux 2
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs nginx git
else
  echo "No se encontro dnf ni yum. Este script es para Amazon Linux." >&2
  exit 1
fi

node -v
npm -v
nginx -v

# ---------- 2. Usuario de servicio dedicado ----------
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creando usuario de servicio $SERVICE_USER..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# ---------- 3. Copiar el codigo a APP_DIR ----------
log "Copiando aplicacion a $APP_DIR..."
mkdir -p "$APP_DIR"
rsync -a --delete --exclude 'node_modules' --exclude '.output' --exclude '.nuxt' "$SOURCE_DIR"/ "$APP_DIR"/

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "No se encontro $APP_DIR/.env." >&2
  echo "Copia api/.env.example a $APP_DIR/.env y completa DATABASE_URL y ADMIN_CODE antes de continuar." >&2
  exit 1
fi
chmod 600 "$APP_DIR/.env"

# ---------- 4. Instalar dependencias y compilar ----------
log "Instalando dependencias y compilando la app..."
cd "$APP_DIR"
npm ci
npx prisma generate
npm run build   # genera .output/server/index.mjs (preset node-server)

chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

# ---------- 5. Servicio systemd ----------
log "Creando servicio systemd $SERVICE_NAME..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Rastro Bunker API (Nuxt/Nitro backend)
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node ${APP_DIR}/.output/server/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

# ---------- 6. nginx: reverse proxy 80 -> 127.0.0.1:$PORT ----------
log "Configurando nginx (80 -> 127.0.0.1:${PORT})..."
NGINX_CONF_DIR="/etc/nginx/conf.d"
mkdir -p "$NGINX_CONF_DIR"
cat > "${NGINX_CONF_DIR}/${SERVICE_NAME}.conf" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

nginx -t
systemctl enable --now nginx
systemctl restart nginx

# ---------- 7. Abrir puerto 80 si firewalld esta activo ----------
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  log "Abriendo puerto 80 en firewalld..."
  firewall-cmd --permanent --add-service=http
  firewall-cmd --reload
fi

log "Listo. Estado de los servicios:"
systemctl --no-pager status "$SERVICE_NAME" || true
systemctl --no-pager status nginx || true

log "Prueba local:"
curl -sS -o /dev/null -w "GET /api/filtros -> %{http_code}\n" "http://127.0.0.1/api/filtros" || true
