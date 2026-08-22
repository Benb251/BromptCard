#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:Failures = New-Object System.Collections.Generic.List[string]

function NoteFail([string]$Message) {
  $script:Failures.Add($Message) | Out-Null
  [Console]::Error.WriteLine("verify-release: FAIL: $Message")
}

function NormalizeZipPath([string]$Name) {
  return (($Name -replace "\\", "/").TrimStart("/"))
}

function StripPackagePrefix([string]$Normalized) {
  if ($Normalized.StartsWith("BromptCard/", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $Normalized.Substring("BromptCard/".Length)
  }
  return $Normalized
}

function Read-Utf8File([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, (New-Object System.Text.UTF8Encoding $false))
}

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "manifest.json"))) {
  NoteFail "manifest.json not found at repository root."
  [Console]::Error.WriteLine("verify-release: $($script:Failures.Count) failure(s)")
  exit 1
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

$ForbiddenZipFragments = @(
  "TASK.md",
  "PROJECT_ADAPTER.md",
  "scripts/",
  ".git/",
  "store/",
  "lib/entitlement.js",
  "Screenshots .png",
  "README.md",
  "PRIVACY.md",
  "icon.svg",
  "StylePromptsystemp.txt"
)

$manifestPath = Join-Path $RepoRoot "manifest.json"
$manifest = $null
try {
  $manifest = (Read-Utf8File $manifestPath) | ConvertFrom-Json
} catch {
  NoteFail "manifest.json is not valid JSON: $($_.Exception.Message)"
}

$version = $null
if ($manifest) {
  $version = [string]$manifest.version
  if ([string]::IsNullOrWhiteSpace($version)) {
    NoteFail "manifest.json has no version field."
  } elseif ($version -notmatch '^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$') {
    NoteFail "manifest version '$version' is not a valid Chrome extension version."
  }
}

foreach ($rel in $RuntimeFiles) {
  $full = Join-Path $RepoRoot $rel
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    NoteFail "required runtime file missing: $rel"
  }
}

$entitlementPath = Join-Path $RepoRoot "lib\entitlement.js"
if (Test-Path -LiteralPath $entitlementPath) {
  NoteFail "obsolete lib/entitlement.js is still present."
}

$jsFiles = Get-ChildItem -LiteralPath $RepoRoot -Recurse -File -Include *.js, *.html |
  Where-Object {
    $p = $_.FullName
    $p -notmatch '[\\/]\.git[\\/]' -and
    $p -notmatch '[\\/]store[\\/]' -and
    $p -notmatch '[\\/]scripts[\\/]'
  }

foreach ($file in $jsFiles) {
  $text = Read-Utf8File $file.FullName
  if ($text -match 'entitlement\.js' -or $text -match 'lib/entitlement') {
    $rel = $file.FullName.Substring($RepoRoot.Length).TrimStart("\", "/")
    NoteFail "obsolete entitlement dependency still referenced in $rel"
  }
}

$installPath = Join-Path $RepoRoot "store\INSTALL.md"
if (-not (Test-Path -LiteralPath $installPath -PathType Leaf)) {
  NoteFail "store/INSTALL.md is missing."
} elseif ($version) {
  $installText = Read-Utf8File $installPath
  $zipRefs = [regex]::Matches($installText, 'BromptCard-([0-9]+(?:\.[0-9]+){1,3})\.zip')
  if ($zipRefs.Count -eq 0) {
    NoteFail "store/INSTALL.md does not reference a BromptCard-<version>.zip file."
  } else {
    foreach ($m in $zipRefs) {
      $refVersion = $m.Groups[1].Value
      if ($refVersion -ne $version) {
        NoteFail "store/INSTALL.md references $($m.Value) but manifest version is $version."
      }
    }
  }
}

$listingPath = Join-Path $RepoRoot "store\LISTING.md"
if (-not (Test-Path -LiteralPath $listingPath -PathType Leaf)) {
  NoteFail "store/LISTING.md is missing."
} else {
  $listingText = Read-Utf8File $listingPath
  $faithfulHits = [regex]::Matches($listingText, 'Faithful').Count
  $styleHits = [regex]::Matches($listingText, 'Style').Count
  if ($faithfulHits -lt 2) {
    NoteFail "store/LISTING.md does not mention Faithful in both listing languages."
  }
  if ($styleHits -lt 2) {
    NoteFail "store/LISTING.md does not mention Style in both listing languages."
  }
}

if ($version) {
  $zipPath = Join-Path $RepoRoot "store\BromptCard-$version.zip"
  if (Test-Path -LiteralPath $zipPath -PathType Leaf) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = $null
    try {
      $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
      $entries = @($archive.Entries | ForEach-Object { NormalizeZipPath $_.FullName })
      $relativeEntries = @($entries | ForEach-Object { StripPackagePrefix $_ })

      $manifestEntries = @($archive.Entries | Where-Object {
        (StripPackagePrefix (NormalizeZipPath $_.FullName)) -eq "manifest.json"
      })
      if ($manifestEntries.Count -ne 1) {
        NoteFail "store/BromptCard-$version.zip must contain exactly one manifest.json."
      } else {
        $stream = $manifestEntries[0].Open()
        try {
          $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $true, 1024, $true)
          $zipManifestRaw = $reader.ReadToEnd()
          $reader.Dispose()
        } finally {
          $stream.Dispose()
        }
        try {
          $zipManifest = $zipManifestRaw | ConvertFrom-Json
          $zipVersion = [string]$zipManifest.version
          if ($zipVersion -ne $version) {
            NoteFail "packaged manifest version '$zipVersion' does not match source manifest version '$version'."
          }
        } catch {
          NoteFail "packaged manifest.json is not valid JSON."
        }
      }

      foreach ($rel in $RuntimeFiles) {
        $want = $rel -replace "\\", "/"
        if ($relativeEntries -notcontains $want) {
          NoteFail "store/BromptCard-$version.zip is missing runtime file: $rel"
        }
      }

      foreach ($entry in $entries) {
        $rel = StripPackagePrefix $entry
        foreach ($frag in $ForbiddenZipFragments) {
          $fragNorm = $frag -replace "\\", "/"
          if ($rel -eq $fragNorm.TrimEnd("/") -or $rel.StartsWith($fragNorm, [System.StringComparison]::OrdinalIgnoreCase)) {
            NoteFail "store/BromptCard-$version.zip contains forbidden path: $entry"
          }
        }
      }
    } catch {
      NoteFail "store/BromptCard-$version.zip could not be opened: $($_.Exception.Message)"
    } finally {
      if ($archive) { $archive.Dispose() }
    }
  } else {
    Write-Host "verify-release: store/BromptCard-$version.zip is not present; skipping package-content checks."
  }
}

if ($script:Failures.Count -gt 0) {
  [Console]::Error.WriteLine("verify-release: $($script:Failures.Count) failure(s)")
  exit 1
}

Write-Host "verify-release: OK"
exit 0
