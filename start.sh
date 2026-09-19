#!/bin/bash
# ============================================================================
# AllCombiner — Start script (lightweight, for shared hosting without PM2)
# ============================================================================
# Usage:
#   ./start.sh           # build + migrate + seed + start
#   ./start.sh run       # start only (assumes build already done)
#   ./start.sh stop      # stop the running server
#   ./start.sh restart   # restart
# ============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
PORT="${PORT:-3000}"
PID_FILE="$APP_DIR/.run/server.pid"
LOG_FILE="$APP_DIR/.run/server.log"

mkdir -p "$APP_DIR/.run"

# Detect package manager
if command -v bun &>/dev/null; then
  PM="bun"
elif command -v npm &>/dev/null; then
  PM="npm"
else
  echo "Error: neither bun nor npm found"
  exit 1
fi

case "${1:-start}" in
  start)
    echo "[start] Building..."
    $PM install
    NODE_ENV=production $PM run build
    echo "[start] Migrating database..."
    $PM run db:push
    $PM run db:seed
    echo "[start] Starting server on port $PORT..."
    NODE_ENV=production PORT=$PORT nohup node .next/standalone/server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "[start] Server PID: $(cat "$PID_FILE")"
    echo "[start] Logs: tail -f $LOG_FILE"
    ;;
  run)
    echo "[run] Starting server on port $PORT..."
    NODE_ENV=production PORT=$PORT nohup node .next/standalone/server.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "[run] Server PID: $(cat "$PID_FILE")"
    ;;
  stop)
    if [[ -f "$PID_FILE" ]]; then
      PID=$(cat "$PID_FILE")
      echo "[stop] Killing PID $PID..."
      kill "$PID" 2>/dev/null || true
      rm -f "$PID_FILE"
      echo "[stop] Stopped."
    else
      echo "[stop] No PID file found. Nothing to stop."
    fi
    ;;
  restart)
    "$0" stop || true
    sleep 1
    "$0" run
    ;;
  status)
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "[status] Running (PID: $(cat "$PID_FILE"))"
    else
      echo "[status] Not running"
      exit 1
    fi
    ;;
  logs)
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "Usage: $0 {start|run|stop|restart|status|logs}"
    exit 1
    ;;
esac
