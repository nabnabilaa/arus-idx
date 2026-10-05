# Daily refresh after the IDX close: free IDX top-up -> retrain -> self-grade -> Telegram digest,
# then commit the new snapshot and push so Vercel redeploys the site and the bot with fresh data.
# Registered as the Windows task "Arus-Daily" (weekdays 17:45). Log: data\daily.log
$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")
$env:PYTHONIOENCODING = "utf-8"
"==== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ====" | Out-File -FilePath data\daily.log -Append -Encoding utf8
python -m arus.agent daily *>> data\daily.log
git add snapshot web/src/data *>> data\daily.log
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "data: daily refresh $(Get-Date -Format 'yyyy-MM-dd')" *>> data\daily.log
    if (git remote) { git push *>> data\daily.log }          # the bot project redeploys from GitHub
    Push-Location web
    npx --yes vercel deploy --prod --yes *>> ..\data\daily.log  # the site is deployed from this machine
    Pop-Location
}
