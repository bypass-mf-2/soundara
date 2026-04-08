# Start Windows SSH Agent and add key (only prompts passphrase once)
$agentService = Get-Service ssh-agent -ErrorAction SilentlyContinue
if ($agentService.Status -ne 'Running') {
    Start-Service ssh-agent
}
ssh-add "$env:USERPROFILE\.ssh\id_ed25519" 2>$null

$SERVER = "root@164.92.82.137"
Set-Location $PSScriptRoot

Write-Host "=== Building frontend ==="
Set-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed"; exit 1 }

Write-Host "=== Uploading frontend ==="
scp -r dist/* "${SERVER}:/var/www/soundara/"

Write-Host "=== Uploading backend ==="
Set-Location ..\backend
scp *.py "${SERVER}:/root/soundara/backend/"
foreach ($dir in @("alpha","beta","gamma","delta","theta","schumann_resonance","middleware")) {
    if (Test-Path $dir) { scp -r $dir "${SERVER}:/root/soundara/backend/" }
}

Write-Host "=== Uploading config files ==="
Set-Location ..
foreach ($f in @("requirements.txt","music_library.json","playlists.json","curated_playlists.json","user_library.json","free_users.json","user_subscriptions.json")) {
    if (Test-Path $f) { scp $f "${SERVER}:/root/soundara/" }
}

Write-Host "=== Uploading start.sh ==="
scp start.sh "${SERVER}:/root/soundara/start.sh"
ssh $SERVER "chmod +x /root/soundara/start.sh"

Write-Host "=== Starting server ==="
ssh $SERVER "bash /root/soundara/start.sh"
