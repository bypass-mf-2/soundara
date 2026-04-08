#!/bin/bash
# Run this locally to build and upload to server
SERVER="root@164.92.82.137"

echo "=== Building frontend ==="
cd "$(dirname "$0")/frontend" && npm run build || { echo "Build failed"; exit 1; }

echo "=== Uploading ==="
cd ..
scp -r frontend/dist/* "$SERVER:/var/www/soundara/"
scp backend/*.py "$SERVER:/root/soundara/backend/"
for dir in alpha beta gamma delta theta schumann_resonance middleware; do
  [ -d "backend/$dir" ] && scp -r "backend/$dir" "$SERVER:/root/soundara/backend/"
done
scp requirements.txt music_library.json playlists.json curated_playlists.json user_library.json free_users.json user_subscriptions.json "$SERVER:/root/soundara/" 2>/dev/null

echo "=== Restarting ==="
ssh "$SERVER" "bash /root/soundara/start.sh"
