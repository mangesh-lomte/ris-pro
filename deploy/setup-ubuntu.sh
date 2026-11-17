#!/usr/bin/env bash
# ==============================================================================
# RadAxis RIS — Automated Turnkey Deployment Script for Ubuntu 24.04 LTS
# ==============================================================================
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/8] Updating Ubuntu system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw ca-certificates gnupg lsb-release nginx

echo "==> [2/8] Configuring UFW Firewall..."
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 4244/tcp || true # DICOM modality port
sudo ufw --force enable || true

echo "==> [3/8] Installing Docker Engine & Compose plugin..."
if ! command -v docker &> /dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER" || true
fi

echo "==> [4/8] Installing Node.js 20 LTS & PM2..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

echo "==> [5/8] Setting up Environment & Installing Workspace Dependencies..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  fi
fi

npm install

echo "==> [6/8] Starting Infrastructure Containers (DB, Orthanc PACS, OHIF Viewer)..."
docker compose up -d

echo "Waiting for PostgreSQL database to be ready on port 5434..."
until docker exec radaxis-db pg_isready -U postgres -d radaxis_ris &> /dev/null; do
  echo "Database initializing... sleeping 2s"
  sleep 2
done

echo "Pushing schema and seeding hospital records..."
npx prisma db push
docker exec -i radaxis-db psql -U postgres -d radaxis_ris -c \
  "CREATE UNIQUE INDEX IF NOT EXISTS unique_active_radiologist_assignment ON radiologist_assignments(\"imagingOrderId\") WHERE status = 'ASSIGNED';" || true
npm run db:seed || true

echo "==> [7/8] Building Server & Client Bundles..."
npm run build

echo "Configuring PM2 to run Backend API Server..."
pm2 delete radaxis-api || true
pm2 start server/dist/server.js --name radaxis-api --time
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" || true

echo "==> [8/8] Configuring Nginx Reverse Proxy..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Substitute actual root path into Nginx configuration
sudo cp "$SCRIPT_DIR/radaxis-nginx.conf" /etc/nginx/sites-available/radaxis.conf
sudo sed -i "s|__CLIENT_DIST_PATH__|$REPO_ROOT/client/dist|g" /etc/nginx/sites-available/radaxis.conf

sudo ln -sf /etc/nginx/sites-available/radaxis.conf /etc/nginx/sites-enabled/radaxis.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "=========================================================================="
echo "✅ RadAxis RIS deployed successfully!"
echo "Backend Health Check: $(curl -s http://127.0.0.1:5000/api/v1/health || echo 'Starting up...')"
echo "Web URL: http://$(curl -s ifconfig.me || echo 'your-server-ip')"
echo "To attach an SSL certificate with a domain, run:"
echo "   sudo apt install -y certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d yourdomain.com"
echo "=========================================================================="
