#!/bin/sh
set -eu

WEB_ROOT=/usr/zte_web/web
STOCK_ROOT=/usr/zte_web/web.stock-beacon
BEACON_ROOT=/mnt/userdata/beacon-web

test -f "$BEACON_ROOT/index.html"
test -d "$BEACON_ROOT/assets"

while mount | grep -q "on $WEB_ROOT "; do
  umount "$WEB_ROOT"
done

mount -o remount,rw /
cleanup() { mount -o remount,ro / >/dev/null 2>&1 || true; }
trap cleanup EXIT

if test -L "$WEB_ROOT"; then
  echo "Beacon web-root link already exists."
elif test -e "$STOCK_ROOT"; then
  echo "Stock backup already exists but web root is not a link; refusing to guess." >&2
  exit 1
else
  mv "$WEB_ROOT" "$STOCK_ROOT"
  ln -s "$BEACON_ROOT" "$WEB_ROOT"
fi

test -f "$WEB_ROOT/index.html"
echo "Beacon is now the persistent web root."
