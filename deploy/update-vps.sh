#!/usr/bin/env bash
# ==============================================================================
# RadAxis RIS — Turnkey Live VPS Update Script (Ubuntu 24.04 LTS)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [1/6] Navigating to repository root: $REPO_ROOT"
cd "$REPO_ROOT"

echo "==> [2/6] Pulling latest commits from GitHub origin main..."
git fetch origin main
git reset --hard origin/main
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "Current VPS Commit: $CURRENT_COMMIT"

echo "==> [3/6] Installing dependencies..."
npm install

echo "==> [4/6] Building production client & server bundles..."
npm run build

echo "==> [5/6] Restarting backend via PM2..."
pm2 restart radaxis-api || pm2 start server/dist/server.js --name radaxis-api --time
pm2 save

echo "==> [6/6] Reloading Nginx reverse proxy..."
sudo cp "$SCRIPT_DIR/radaxis-nginx.conf" /etc/nginx/sites-available/radaxis.conf
sudo sed -i "s|__CLIENT_DIST_PATH__|$REPO_ROOT/client/dist|g" /etc/nginx/sites-available/radaxis.conf
sudo nginx -t
sudo systemctl reload nginx

echo "=========================================================================="
echo "✅ RadAxis RIS Live VPS Updated Successfully to Commit $CURRENT_COMMIT!"
echo "Backend Health Check:"
curl -s http://127.0.0.1:5000/api/v1/health || echo "Backend restarting..."
echo ""
echo "Public Verification:"
echo "Web URL: http://$(curl -s ifconfig.me || echo '43.254.29.214')"
echo "=========================================================================="
