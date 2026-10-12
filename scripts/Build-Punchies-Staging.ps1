$ErrorActionPreference='Stop'
$stageCheckout=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../punchies-local-staging'))
if (!(Test-Path -LiteralPath (Join-Path $stageCheckout 'scripts/build-punchies-staging.mjs'))) { throw 'The isolated staging checkout is missing.' }
Push-Location $stageCheckout
try { node scripts/build-punchies-staging.mjs '../../outputs/staging/site'; if ($LASTEXITCODE -ne 0) { throw 'Staging build failed.' } } finally { Pop-Location }
