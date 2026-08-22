#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  [Console]::Error.WriteLine("package-release: $Message")
  exit 1
}

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "manifest.json"))) {
  Fail "manifest.json not found; run this script from the BromptCard repository."
}

$manifestPath = Join-Path $RepoRoot "manifest.json"
try {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Fail "manifest.json is not valid JSON: $($_.Exception.Message)"
}

$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  Fail "manifest.json has no version."
}
if ($version -notmatch '^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$') {
  Fail "manifest version '$version' is not a valid Chrome extension version."
}

$RuntimeFiles = @(
  "manifest.json",
  "background.js",
  "constants.js",
  "content.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "storage.js",
  "automation/inject.js",
  "automation/orchestrator.js",
  "lib/image.js",
  "lib/prompt.js",
  "lib/schema.js",
  "providers/gemini.js",
  "providers/index.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png"
)

foreach ($rel in $RuntimeFiles) {
  $full = Join-Path $RepoRoot $rel
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Fail "required runtime file missing: $rel"
  }
}

$deadEntitlement = Join-Path $RepoRoot "lib\entitlement.js"
if (Test-Path -LiteralPath $deadEntitlement) {
  Fail "lib/entitlement.js is present; do not package removed entitlement code."
}

$storeDir = Join-Path $RepoRoot "store"
if (-not (Test-Path -LiteralPath $storeDir -PathType Container)) {
  New-Item -ItemType Directory -Path $storeDir | Out-Null
}

$zipName = "BromptCard-$version.zip"
$zipPath = [System.IO.Path]::GetFullPath((Join-Path $storeDir $zipName))
$storeFull = [System.IO.Path]::GetFullPath($storeDir)
$repoFull = [System.IO.Path]::GetFullPath($RepoRoot)
if (-not $zipPath.StartsWith($storeFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  Fail "refusing to write zip outside store/: $zipPath"
}
if (-not $storeFull.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  Fail "refusing to operate outside this repository."
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = $null
try {
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  foreach ($rel in ($RuntimeFiles | Sort-Object)) {
    $source = Join-Path $RepoRoot $rel
    $entryName = ("BromptCard/" + ($rel -replace "\\", "/"))
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $source,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
  }
} catch {
  if ($zip) { $zip.Dispose() }
  if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
  Fail "failed to create $zipName : $($_.Exception.Message)"
} finally {
  if ($zip) { $zip.Dispose() }
}

if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
  Fail "zip was not written: $zipPath"
}

Write-Host "Wrote $zipPath"
exit 0
