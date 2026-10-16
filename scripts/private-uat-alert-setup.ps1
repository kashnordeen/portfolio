# HUMAN-RUN ONLY in a private PowerShell 7 window. Never paste keys into chat.
# No credentials in command arguments, environment variables, files or printed output.
# Do not run under a debugger/transcript. No Administrator or execution-policy change needed.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$privateQstash = $null
$privateBypass = $null
$packet = $null
function Read-PrivateValue([Security.SecureString]$Value) {
    $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer) }
}
try {
    $nodePath = @(Get-Command node -CommandType Application -ErrorAction Stop)[0].Source
    $helperPath = Join-Path $PSScriptRoot 'uat-alert-operations.mjs'
    Write-Host 'UAT ONLY. Existing paused schedule; two no-money checks. Nothing is resumed during preparation.'
    $privateQstash = Read-Host 'Paste the existing US Region QSTASH_TOKEN (hidden)' -AsSecureString
    $privateBypass = Read-Host 'Paste the regenerated UAT Vercel bypass key (hidden)' -AsSecureString
    $packet = @{ qstashToken=(Read-PrivateValue $privateQstash); bypassKey=(Read-PrivateValue $privateBypass); operation='prepare' }
    $resultText = ($packet | ConvertTo-Json -Compress) | & $nodePath $helperPath
    if ($LASTEXITCODE -ne 0) { throw 'UAT setup refused. Check the paused schedule privately.' }
    $result = $resultText | ConvertFrom-Json
    if ($result.ok -ne $true) { throw 'UAT setup refused.' }
    Write-Host 'TESTS QUEUED. Keep this window open and tell Codex: test queued.'
    Write-Host ('Recovery receipt: ' + $result.recoveryMessageId)
    Write-Host ('Intentional failure receipt: ' + $result.failureMessageId)
    Write-Host 'Wait for Codex to confirm recovery HTTP 200 and the expected alert email delivery.'
    Write-Host 'Only then type VERIFIED to update and resume the SAME UAT schedule. Anything else stops without changing it.'
    $confirmation = Read-Host 'Confirmation'
    if ($confirmation -cne 'VERIFIED') { Write-Host 'STOPPED. No schedule change was requested.'; return }
    $packet.operation = 'apply'
    $packet.operatorVerified = $true
    $resultText = ($packet | ConvertTo-Json -Compress) | & $nodePath $helperPath
    if ($LASTEXITCODE -ne 0) { throw 'UAT update failed. Check the paused state privately before continuing.' }
    $result = $resultText | ConvertFrom-Json
    if ($result.ok -ne $true -or $result.schedulePaused -ne $false) { throw 'UAT update not verified.' }
    Write-Host 'UAT SCHEDULE CONFIGURED AND RESUMED. Tell Codex: setup completed.'
} catch {
    # Do not print $_, the packet or arbitrary subprocess/HTTP error contents.
    Write-Host 'UAT SETUP STOPPED. Ask Codex to check statuses; do not paste keys or raw error details.'
} finally {
    $packet = $null
    $resultText = $null
    $result = $null
    if ($null -ne $privateQstash) { $privateQstash.Dispose() }
    if ($null -ne $privateBypass) { $privateBypass.Dispose() }
}
