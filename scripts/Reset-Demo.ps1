[CmdletBinding()]
param(
    [switch]$ResetDemo,
    [string]$DatabasePath = '',
    [string]$PythonPath = ''
)

$ErrorActionPreference = 'Stop'

function Stop-WithError {
    param([string]$Message)
    [Console]::Error.WriteLine("ERROR: $Message")
    exit 2
}

function Get-ConfiguredDatabaseUrl {
    param([string]$RepositoryRoot)

    if ($env:DATABASE_URL) { return $env:DATABASE_URL.Trim() }

    $envFile = Join-Path $RepositoryRoot '.env'
    if (Test-Path -LiteralPath $envFile -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $envFile) {
            if ($line -match '^\s*DATABASE_URL\s*=\s*(.+?)\s*$') {
                return $Matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }

    return 'sqlite:///./backend/app.db'
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backendRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'backend'))
$backendPrefix = $backendRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$rawDirectory = Join-Path $repoRoot 'data\raw'

if ($DatabasePath) {
    $candidatePath = $DatabasePath
}
else {
    $databaseUrl = Get-ConfiguredDatabaseUrl -RepositoryRoot $repoRoot
    if (-not $databaseUrl.StartsWith('sqlite:///', [StringComparison]::OrdinalIgnoreCase)) {
        Stop-WithError '演示复位只支持本地 SQLite；当前 DATABASE_URL 不是 sqlite:/// 地址。'
    }
    $candidatePath = $databaseUrl.Substring('sqlite:///'.Length)
    if (-not $candidatePath -or $candidatePath -eq ':memory:' -or $candidatePath.Contains('?')) {
        Stop-WithError 'DATABASE_URL 必须指向一个明确的本地 SQLite 文件。'
    }
}

if ([IO.Path]::IsPathRooted($candidatePath)) {
    $databaseFile = [IO.Path]::GetFullPath($candidatePath)
}
else {
    $databaseFile = [IO.Path]::GetFullPath((Join-Path $repoRoot $candidatePath))
}

$databaseExtension = [IO.Path]::GetExtension($databaseFile).ToLowerInvariant()
if (-not $databaseFile.StartsWith($backendPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    Stop-WithError "拒绝复位仓库 backend 目录之外的路径：$databaseFile"
}
if ($databaseExtension -notin @('.db', '.sqlite', '.sqlite3')) {
    Stop-WithError "拒绝复位非 SQLite 文件：$databaseFile"
}

$databaseParent = Split-Path -Parent $databaseFile
if (-not (Test-Path -LiteralPath $databaseParent -PathType Container)) {
    Stop-WithError "数据库父目录不存在：$databaseParent"
}

if (-not $PythonPath) {
    $PythonPath = Join-Path $backendRoot '.venv\Scripts\python.exe'
}
if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
    Stop-WithError "未找到 Python 环境：$PythonPath。请先按 docs/DEMO_RUNBOOK.md 完成首次安装。"
}
$resolvedPython = [IO.Path]::GetFullPath($PythonPath)

if (-not (Test-Path -LiteralPath $rawDirectory -PathType Container)) {
    Stop-WithError "未找到演示数据目录：$rawDirectory"
}
$seedCount = @(Get-ChildItem -LiteralPath $rawDirectory -Filter '*.json' -File).Count
if ($seedCount -eq 0) {
    Stop-WithError "演示数据目录中没有 JSON 文件：$rawDirectory"
}

Write-Output "仓库根目录：$repoRoot"
Write-Output "演示数据库绝对路径：$databaseFile"
Write-Output "演示数据目录：$rawDirectory（$seedCount 个 JSON）"

if (-not $ResetDemo) {
    Stop-WithError '未执行任何删除。复位演示数据库必须显式传入 -ResetDemo。'
}

$databaseFiles = @($databaseFile, "$databaseFile-wal", "$databaseFile-shm")
foreach ($path in $databaseFiles) {
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Write-Output "即将删除：$([IO.Path]::GetFullPath($path))"
        Remove-Item -LiteralPath $path -Force
    }
}

$previousDatabaseUrl = $env:DATABASE_URL
$normalizedDatabaseFile = $databaseFile.Replace('\', '/')
$env:DATABASE_URL = "sqlite:///$normalizedDatabaseFile"

try {
    Push-Location $repoRoot
    try {
        & $resolvedPython -m backend.scripts.import_seed_data
        $importExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:DATABASE_URL = $previousDatabaseUrl
}

if ($importExitCode -ne 0) {
    Stop-WithError "演示数据导入失败，退出码：$importExitCode"
}

Write-Output "演示环境复位完成：已从 $seedCount 个 JSON 重建数据库。"
