param([int]$Port=5310)
$ErrorActionPreference='Stop'
$stageOutput=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../outputs/staging'))
$stageRoot=Join-Path $stageOutput 'site'
$stageServer=Join-Path $PSScriptRoot 'serve-punchies-staging.mjs'
$stageState=Join-Path $stageOutput 'server-state.json'
if (!(Test-Path -LiteralPath (Join-Path $stageRoot 'stage.json'))) { throw 'Build staging first using Build-Punchies-Staging.ps1.' }
if (Test-Path -LiteralPath $stageState) {
 $prior=Get-Content -LiteralPath $stageState -Raw | ConvertFrom-Json
 $existing=Get-CimInstance Win32_Process -Filter "ProcessId = $($prior.pid)"
 if ($existing -and $existing.CommandLine.Contains($stageServer)) { Write-Output $prior.url; exit }
}
$stageNode=(Get-Command node -ErrorAction Stop).Source
$stageProcess=Start-Process -FilePath $stageNode -ArgumentList @(('"{0}"' -f $stageServer),('"{0}"' -f $stageRoot),$Port) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stageOutput 'server.log') -RedirectStandardError (Join-Path $stageOutput 'server-errors.log')
Start-Sleep -Milliseconds 500
if ($stageProcess.HasExited) { throw (Get-Content (Join-Path $stageOutput 'server-errors.log') -Raw) }
@{pid=$stageProcess.Id;url="http://127.0.0.1:$Port/";server=$stageServer;root=$stageRoot} | ConvertTo-Json | Set-Content -LiteralPath $stageState
Write-Output "http://127.0.0.1:$Port/"
