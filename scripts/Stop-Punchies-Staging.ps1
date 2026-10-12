$ErrorActionPreference='Stop'
$stageOutput=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../outputs/staging'))
$stageState=Join-Path $stageOutput 'server-state.json'
if (!(Test-Path -LiteralPath $stageState)) { Write-Output 'Staging already stopped.'; exit }
$saved=Get-Content -LiteralPath $stageState -Raw | ConvertFrom-Json
$stageProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $($saved.pid)"
$expectedServer=Join-Path $PSScriptRoot 'serve-punchies-staging.mjs'
if ($stageProcess) {
 if (!$stageProcess.CommandLine.Contains($expectedServer)) { throw 'PID belongs to another process; left it running.' }
 Stop-Process -Id $saved.pid
}
Remove-Item -LiteralPath $stageState
Write-Output 'Staging stopped.'
