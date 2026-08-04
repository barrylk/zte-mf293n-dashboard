#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BIN="$ROOT/runtime"
CONFIG="$ROOT/config.json"
PIDFILE="$ROOT/runtime.pid"
LOGFILE="$ROOT/runtime.log"

case "${1:-status}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "runtime already running"
      exit 0
    fi
    [ -x "$BIN" ] || { echo "runtime binary is missing"; exit 1; }
    if [ -f "$CONFIG" ]; then
      "$BIN" run -c "$CONFIG" >>"$LOGFILE" 2>&1 &
    else
      "$BIN" >>"$LOGFILE" 2>&1 &
    fi
    echo $! >"$PIDFILE"
    echo "runtime started"
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
    fi
    echo "runtime stopped"
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "running pid $(cat "$PIDFILE")"
    else
      echo "stopped"
    fi
    ;;
  log)
    tail -n 80 "$LOGFILE" 2>/dev/null || true
    ;;
  *)
    echo "usage: $0 {start|stop|status|log}"
    exit 2
    ;;
esac
