#!/bin/sh
set -eu

WEB_ROOT=/usr/zte_web/web
STOCK_ROOT=/usr/zte_web/web.stock-beacon

while mount | grep -q "on $WEB_ROOT "; do
  umount "$WEB_ROOT"
done

mount -o remount,rw /
cleanup() { mount -o remount,ro / >/dev/null 2>&1 || true; }
trap cleanup EXIT

if test -L "$WEB_ROOT" && test -d "$STOCK_ROOT"; then
  rm "$WEB_ROOT"
  mv "$STOCK_ROOT" "$WEB_ROOT"
elif test -d "$WEB_ROOT" && test ! -e "$STOCK_ROOT"; then
  echo "Stock web root is already active."
  exit 0
else
  echo "Unexpected web-root layout; refusing to modify it." >&2
  exit 1
fi

test -f "$WEB_ROOT/index.html"
echo "Stock web root restored."
