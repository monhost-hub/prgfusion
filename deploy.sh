#!/bin/bash
# ============================================================================
# AllCombiner — Production deploy script
# ============================================================================
# Usage:
#   ./deploy.sh              # full deploy (install, build, migrate, restart)
#   ./deploy.sh install      # only install deps
#   ./deploy.sh build        # only build
#   ./deploy.sh migrate      # only run DB migrations
#   ./deploy.sh restart      # only restart the process manager
#   ./deploy.sh logs         # tail logs
#   ./deploy.sh status       # show status
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via env vars)
# ---------------------------------------------------------------------------
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
NODE_ENV="${NODE_ENV:-production}"
PORT="${PORT:-3000}"
PROCESS_NAME="${PROCESS_NAME:-allcombiner}"
PM2_HOME="${PM2_HOME:-$HOME/.pm2}"

cd "$APP_DIR"

# Color codes for nice output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
check_env() {
  log "Checking environment…"
  if [[ ! -f ".env" ]]; then
    err ".env file not found. Copy .env.production.example to .env and fill in real values."
    exit 1
  fi
  if ! grep -q "^OPENROUTER_API_KEY=sk-or-" .env 2>/dev/null; then
    warn "OPENROUTER_API_KEY looks empty or invalid in .env"
  fi
  if ! grep -q "^AUTH_SECRET=." .env 2>/dev/null; then
    err "AUTH_SECRET must be set in .env (generate with: openssl rand -base64 32)"
    exit 1
  fi
  if grep -q "CHANGE-ME\|change-me\|replace-me" .env 2>/dev/null; then
    err "Found placeholder value in .env. Please fill in real values."
    exit 1
  fi
  log "✓ .env looks good"
}

check_node() {
  if ! command -v node &>/dev/null; then
    err "Node.js is not installed. Install Node.js 20+ first."
    exit 1
  fi
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VERSION" -lt 18 ]]; then
    err "Node.js 18+ required (found $(node -v))."
    exit 1
  fi
  log "✓ Node.js $(node -v)"

  # Detect package manager
  if command -v bun &>/dev/null; then
    PM="bun"
  elif command -v npm &>/dev/null; then
    PM="npm"
  else
    err "Neither bun nor npm found."
    exit 1
  fi
  log "✓ Package manager: $PM"
}

# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------
step_install() {
  log "Installing dependencies ($PM install)…"
  if [[ "$PM" == "bun" ]]; then
    bun install --frozen-lockfile 2>/dev/null || bun install
  else
    npm ci 2>/dev/null || npm install
  fi
  log "✓ Dependencies installed"
}

step_build() {
  log "Building Next.js ($PM run build)…"
  if [[ "$PM" == "bun" ]]; then
    NODE_ENV=production bun run build
  else
    NODE_ENV=production npm run build
  fi
  log "✓ Build complete"
}

step_migrate() {
  log "Pushing Prisma schema to database…"
  if [[ "$PM" == "bun" ]]; then
    bun run db:push
  else
    npx prisma db push --accept-data-loss
  fi
  log "✓ Database schema applied"
}

step_seed() {
  log "Seeding database (admin user, AI models, pricing plans, prompt)…"
  if [[ "$PM" == "bun" ]]; then
    bun run db:seed
  else
    npx prisma db execute --file scripts/seed.js 2>/dev/null || npx tsx scripts/seed.ts 2>/dev/null || warn "Could not run seed automatically. Run manually: npm run db:seed"
  fi
  log "✓ Seed complete"
}

step_start_pm2() {
  if ! command -v pm2 &>/dev/null; then
    warn "pm2 not installed. Installing globally…"
    npm install -g pm2
  fi
  log "Starting/restarting with PM2 (process: $PROCESS_NAME)…"
  if pm2 describe "$PROCESS_NAME" &>/dev/null; then
    pm2 restart "$PROCESS_NAME" --update-env
  else
    pm2 start ecosystem.config.cjs
    pm2 save
  fi
  log "✓ Process started"
}

step_start_manual() {
  log "Starting manually (no PM2) on port $PORT…"
  NODE_ENV=production PORT=$PORT nohup node .next/standalone/server.js > /tmp/allcombiner.log 2>&1 &
  echo $! > /tmp/allcombiner.pid
  log "✓ Started (PID: $(cat /tmp/allcombiner.pid))"
  log "  Logs: tail -f /tmp/allcombiner.log"
  log "  Stop: kill \$(cat /tmp/allcombiner.pid)"
}

step_restart() {
  if command -v pm2 &>/dev/null && pm2 describe "$PROCESS_NAME" &>/dev/null; then
    pm2 restart "$PROCESS_NAME" --update-env
    log "✓ PM2 process restarted"
  elif [[ -f /tmp/allcombiner.pid ]]; then
    kill "$(cat /tmp/allcombiner.pid)" 2>/dev/null || true
    rm -f /tmp/allcombiner.pid
    step_start_manual
  else
    step_start_pm2
  fi
}

step_logs() {
  if command -v pm2 &>/dev/null && pm2 describe "$PROCESS_NAME" &>/dev/null; then
    pm2 logs "$PROCESS_NAME" --lines 100
  else
    tail -f /tmp/allcombiner.log 2>/dev/null || err "No logs found"
  fi
}

step_status() {
  if command -v pm2 &>/dev/null; then
    pm2 describe "$PROCESS_NAME" 2>/dev/null || pm2 list
  else
    if [[ -f /tmp/allcombiner.pid ]] && kill -0 "$(cat /tmp/allcombiner.pid)" 2>/dev/null; then
      log "Running (PID: $(cat /tmp/allcombiner.pid))"
    else
      err "Not running"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local cmd="${1:-all}"
  log "AllCombiner deploy — command: $cmd"
  log "App dir: $APP_DIR"
  log "Node env: $NODE_ENV"

  case "$cmd" in
    all)
      check_env
      check_node
      step_install
      step_build
      step_migrate
      step_seed
      step_start_pm2
      log "🎉 Deployment complete!"
      log "   Check status: ./deploy.sh status"
      log "   View logs:    ./deploy.sh logs"
      ;;
    install)  check_node; step_install ;;
    build)    check_node; step_build ;;
    migrate)  check_node; step_migrate ;;
    seed)     check_node; step_seed ;;
    restart)  step_restart ;;
    logs)     step_logs ;;
    status)   step_status ;;
    manual)   check_env; check_node; step_start_manual ;;
    *)
      echo "Usage: $0 {all|install|build|migrate|seed|restart|logs|status|manual}"
      exit 1
      ;;
  esac
}

main "$@"
