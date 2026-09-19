[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PythonPath
)

$ErrorActionPreference = 'Stop'

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resetScript = Join-Path $PSScriptRoot 'Reset-Demo.ps1'
$testId = [Guid]::NewGuid().ToString('N')
$insideDatabase = Join-Path $repoRoot "backend\demo-reset-safety-test-$testId.db"
$outsideDatabase = Join-Path ([IO.Path]::GetTempPath()) "xiaoshiqing-outside-reset-test-$testId.db"
$pwsh = Join-Path $PSHOME 'pwsh.exe'

if (-not (Test-Path -LiteralPath $resetScript -PathType Leaf)) {
    throw "Missing reset script: $resetScript"
}
if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
    throw "Python executable not found: $PythonPath"
}

function Invoke-ResetScript {
    param([string[]]$Arguments)

    $output = & $pwsh -NoProfile -File $resetScript @Arguments 2>&1 | Out-String
    return [PSCustomObject]@{
        ExitCode = $LASTEXITCODE
        Output = $output
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

try {
    [IO.File]::WriteAllText($insideDatabase, 'KEEP-INSIDE')
    $withoutFlag = Invoke-ResetScript -Arguments @(
        '-DatabasePath', $insideDatabase,
        '-PythonPath', $PythonPath
    )
    Assert-True ($withoutFlag.ExitCode -ne 0) 'Reset without -ResetDemo must fail.'
    Assert-True ((Get-Content -LiteralPath $insideDatabase -Raw) -eq 'KEEP-INSIDE') 'Reset without flag changed the database.'

    [IO.File]::WriteAllText($outsideDatabase, 'KEEP-OUTSIDE')
    $outside = Invoke-ResetScript -Arguments @(
        '-ResetDemo',
        '-DatabasePath', $outsideDatabase,
        '-PythonPath', $PythonPath
    )
    Assert-True ($outside.ExitCode -ne 0) 'Reset outside backend must fail.'
    Assert-True ((Get-Content -LiteralPath $outsideDatabase -Raw) -eq 'KEEP-OUTSIDE') 'Outside database was changed.'

    $first = Invoke-ResetScript -Arguments @(
        '-ResetDemo',
        '-DatabasePath', $insideDatabase,
        '-PythonPath', $PythonPath
    )
    Assert-True ($first.ExitCode -eq 0) "First reset failed:`n$($first.Output)"
    Assert-True ($first.Output.Contains([IO.Path]::GetFullPath($insideDatabase))) 'Reset did not print the absolute database path.'
    Assert-True ($first.Output -match 'Scanned: (\d+); imported: \1; skipped: 0; failed: 0') 'First reset did not import every scanned seed exactly once.'

    $second = Invoke-ResetScript -Arguments @(
        '-ResetDemo',
        '-DatabasePath', $insideDatabase,
        '-PythonPath', $PythonPath
    )
    Assert-True ($second.ExitCode -eq 0) "Second reset failed:`n$($second.Output)"
    Assert-True ($second.Output -match 'Scanned: (\d+); imported: \1; skipped: 0; failed: 0') 'Second reset was not deterministic.'

    Write-Output 'PASS: explicit flag, path boundary, and repeatable reset checks succeeded.'
}
finally {
    if (Test-Path -LiteralPath $insideDatabase -PathType Leaf) {
        Remove-Item -LiteralPath $insideDatabase -Force
    }
    if (Test-Path -LiteralPath $outsideDatabase -PathType Leaf) {
        Remove-Item -LiteralPath $outsideDatabase -Force
    }
}
