#!/bin/bash
SERVER="root@164.92.82.137"
REMOTE_DIR="/root/soundara"
FRONTEND_DIR="/var/www/soundara"

echo "=== Building frontend ==="
cd "$(dirname "$0")/frontend" && npm run build || { echo "Build failed"; exit 1; }

echo "=== Uploading frontend ==="
scp -r dist/* "$SERVER:$FRONTEND_DIR/"

echo "=== Uploading backend ==="
cd ../backend
scp *.py "$SERVER:$REMOTE_DIR/backend/"
for dir in alpha beta gamma delta theta schumann_resonance middleware; do
  [ -d "$dir" ] && scp -r "$dir" "$SERVER:$REMOTE_DIR/backend/"
done

echo "=== Uploading config files ==="
cd ..
scp requirements.txt music_library.json playlists.json curated_playlists.json user_library.json free_users.json user_subscriptions.json "$SERVER:$REMOTE_DIR/" 2>/dev/null

echo "=== Restarting backend ==="
ssh "$SERVER" "systemctl restart soundara.service"

echo "=== Done! Site live at https://soundara.co ==="
