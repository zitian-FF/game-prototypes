param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$ReviewedSha,[switch]$OwnerApproved)
$ErrorActionPreference='Stop'
if (!$OwnerApproved) { throw 'Explicit owner itch approval is required. Stage READY is not approval.' }
$live=Invoke-RestMethod -Uri "https://zitian-ff.github.io/game-prototypes/staging/punchies/stage.json?promotion=$ReviewedSha"
if ($live.sha -ne $ReviewedSha) { throw 'SHA must match the current reviewed public staging source.' }
gh workflow run promote-punchies-reviewed.yml --repo zitian-FF/game-prototypes --ref main -f "reviewed_sha=$ReviewedSha" -f "owner_approved_sha=$ReviewedSha"
if ($LASTEXITCODE -ne 0) { throw 'Promotion dispatch failed.' }
Write-Host "Dispatched approved source $ReviewedSha; CI production safety/compatibility checks run before upload."
