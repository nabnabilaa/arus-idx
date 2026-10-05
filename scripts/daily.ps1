# Daily refresh after the IDX close: free IDX top-up -> retrain -> self-grade -> Telegram digest.
# Registered as the Windows task "Arus-Daily" (weekdays 17:45). Log: data\daily.log
$ErrorActionPreference = "Continue"
Set-Location -Path (Join-Path $PSScriptRoot "..")
$env:PYTHONIOENCODING = "utf-8"
"==== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ====" | Out-File -FilePath data\daily.log -Append -Encoding utf8
python -m arus.agent daily *>> data\daily.log
