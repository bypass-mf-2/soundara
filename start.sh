#!/bin/bash
cd /root/soundara

echo "=== Installing dependencies ==="
backend/venv/bin/pip install -r requirements.txt -q

echo "=== Restarting backend ==="
systemctl restart soundara.service

echo "=== Reloading nginx ==="
nginx -s reload 2>/dev/null

sleep 3
echo "=== Status ==="
systemctl is-active soundara.service
curl -s -o /dev/null -w "API: %{http_code}\n" http://localhost:8000/
curl -s -o /dev/null -w "Site: %{http_code}\n" http://localhost:80/
echo "=== Soundara is live ==="
