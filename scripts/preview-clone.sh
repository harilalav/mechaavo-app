#!/usr/bin/env bash
# Builds a COPY of the app (a production build) and serves it on :3150, so a running
# `next dev` (which owns .next in the real repo) is never disturbed. Used by
# `npm run design:sweep -- --build`; also handy on its own for Lighthouse runs.
#
#   bash scripts/preview-clone.sh            build the copy and serve it on :3150
#   PORT=3250 bash scripts/preview-clone.sh  another port (see below)
#   bash scripts/preview-clone.sh --stop     stop OUR server on that port
#
# The copy lives in $TMPDIR/mechaavo-clone-<port> (never inside the repo; one copy per
# port, so two sessions on two ports never share a build directory). node_modules is
# cloned once (copy-on-write on APFS) and refreshed when package-lock.json changes.
#
# Only a server this script started (its working directory is the copy) is ever stopped.
# If something else holds the port, for instance another session's copy, the script says
# so and exits: pick a free port with PORT=<n>.
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3150}"
CLONE="${CLONE_DIR:-${TMPDIR:-/tmp}/mechaavo-clone-$PORT}"
CLONE="${CLONE%/}"
BUILD_LOG="${CLONE}-build.log"
SERVER_LOG="${CLONE}-server.log"
# the path as the system reports a process's working directory (on macOS /var is /private/var)
mkdir -p "$CLONE"
CLONE_REAL="$(cd "$CLONE" && pwd -P)"

# stop our own server on $PORT; refuse to touch anybody else's
stop_server() {
  local pid cwd
  for pid in $(lsof -ti:"$PORT" 2>/dev/null || true); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    if [ "$cwd" = "$CLONE_REAL" ]; then
      kill "$pid" 2>/dev/null || true
    else
      echo "port $PORT is in use by another process (pid $pid, in ${cwd:-?}), not ours: use PORT=<a free port>" >&2
      exit 1
    fi
  done
  sleep 0.5
}

if [ "${1:-}" = "--stop" ]; then
  stop_server
  echo "stopped our server on :$PORT (if there was one)"
  exit 0
fi

stop_server
mkdir -p "$CLONE"
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .agents --exclude .claude \
  --exclude .lockhash --exclude tsconfig.tsbuildinfo \
  "$APP"/ "$CLONE"/

LOCK_HASH="$(shasum "$APP/package-lock.json" | cut -d' ' -f1)"
if [ ! -d "$CLONE/node_modules" ] || [ "$(cat "$CLONE/.lockhash" 2>/dev/null || true)" != "$LOCK_HASH" ]; then
  rm -rf "$CLONE/node_modules"
  cp -cR "$APP/node_modules" "$CLONE/node_modules" 2>/dev/null || cp -R "$APP/node_modules" "$CLONE/node_modules"
  echo "$LOCK_HASH" > "$CLONE/.lockhash"
fi

cd "$CLONE"
rm -rf .next
if ! npm run build > "$BUILD_LOG" 2>&1; then
  tail -40 "$BUILD_LOG"
  echo "build failed (full log: $BUILD_LOG)" >&2
  exit 1
fi

nohup "$CLONE/node_modules/.bin/next" start "$CLONE" -p "$PORT" > "$SERVER_LOG" 2>&1 &
for _ in $(seq 1 80); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" || true)"
  if [ "$code" = "200" ]; then
    echo "production copy up on http://localhost:$PORT (build log: $BUILD_LOG)"
    exit 0
  fi
  sleep 0.5
done
tail -5 "$SERVER_LOG" >&2
echo "server did not come up on :$PORT" >&2
exit 1
