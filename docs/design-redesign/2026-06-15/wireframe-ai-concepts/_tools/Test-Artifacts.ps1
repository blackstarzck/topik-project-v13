param(
  [string]$SourceRoot = "docs\Wireframe",
  [string]$OutputRoot = "docs\design-redesign\2026-06-15\wireframe-ai-concepts",
  [int]$ExpectedStates = 39,
  [int]$ExpectedConceptsPerState = 3
)

$ErrorActionPreference = "Stop"
$ExpectedImages = $ExpectedStates * $ExpectedConceptsPerState
$RequiredFiles = @("image.png", "prompt.json", "meta.json", "review.json")
$AllowedStatuses = @("accepted", "generated_with_issues", "rejected", "failed", "missing")

$failures = New-Object System.Collections.Generic.List[string]
function Fail($msg) { $script:failures.Add($msg) | Out-Null }

$sources = Get-ChildItem -Path $SourceRoot -Recurse -File -Filter "browser-screenshot--*--desktop.png"
if ($sources.Count -ne $ExpectedStates) {
  Fail "source screenshot count expected $ExpectedStates, actual $($sources.Count)"
}

if (!(Test-Path $OutputRoot -PathType Container)) {
  Fail "output root missing: $OutputRoot"
}

$manifestPath = Join-Path $OutputRoot "manifest.json"
if (!(Test-Path $manifestPath -PathType Leaf)) {
  Fail "manifest missing: $manifestPath"
} else {
  try {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  } catch {
    Fail "manifest.json is not valid JSON: $($_.Exception.Message)"
  }
}

$conceptDirs = Get-ChildItem -Path $OutputRoot -Recurse -Directory |
  Where-Object { $_.Name -match '^concept-\d{2}$' }

if ($conceptDirs.Count -ne $ExpectedImages) {
  Fail "concept directory count expected $ExpectedImages, actual $($conceptDirs.Count)"
}

$stateGroups = $conceptDirs | Group-Object {
  $rel = Resolve-Path -LiteralPath $_.FullName -Relative
  $rel = $rel -replace '^\.\\' -replace '\\','/'
  Split-Path $rel -Parent
}

if ($stateGroups.Count -ne $ExpectedStates) {
  Fail "generated state count expected $ExpectedStates, actual $($stateGroups.Count)"
}

foreach ($g in $stateGroups) {
  if ($g.Count -ne $ExpectedConceptsPerState) {
    Fail "state '$($g.Name)' concept count expected $ExpectedConceptsPerState, actual $($g.Count)"
  }
}

$images = Get-ChildItem -Path $OutputRoot -Recurse -File -Filter "image.png"
if ($images.Count -ne $ExpectedImages) {
  Fail "image.png count expected $ExpectedImages, actual $($images.Count)"
}

foreach ($dir in $conceptDirs) {
  foreach ($file in $RequiredFiles) {
    $path = Join-Path $dir.FullName $file
    if (!(Test-Path $path -PathType Leaf)) {
      Fail "missing required file: $path"
      continue
    }
    if ((Get-Item $path).Length -le 0) {
      Fail "empty required file: $path"
    }
    if ($file -like "*.json") {
      try {
        Get-Content $path -Raw | ConvertFrom-Json | Out-Null
      } catch {
        Fail "invalid JSON: $path"
      }
    }
  }
}

function Get-JsonStringValues($node) {
  if ($null -eq $node) { return }
  if ($node -is [string]) { $node; return }
  if ($node -is [System.Collections.IEnumerable] -and $node -isnot [string]) {
    foreach ($item in $node) { Get-JsonStringValues $item }
    return
  }
  if ($node.PSObject -and $node.PSObject.Properties) {
    foreach ($p in $node.PSObject.Properties) { Get-JsonStringValues $p.Value }
  }
}

if (Test-Path $manifestPath -PathType Leaf) {
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $manifestPaths = Get-JsonStringValues $manifest |
    Where-Object { $_ -match '(^|/)(image\.png|prompt\.json|meta\.json|review\.json)$' } |
    ForEach-Object { ($_ -replace '\\','/').TrimStart("./") } |
    Sort-Object -Unique

  foreach ($rel in $manifestPaths) {
    if ([System.IO.Path]::IsPathRooted($rel) -or $rel -match '(^|/)\.\.(/|$)') {
      Fail "manifest path is not safe relative path: $rel"
      continue
    }
    $actual = Join-Path $OutputRoot ($rel -replace '/', '\')
    if (!(Test-Path $actual -PathType Leaf)) {
      Fail "manifest path does not exist: $rel"
    }
  }
}

$statusCounts = [ordered]@{}
foreach ($s in $AllowedStatuses) { $statusCounts[$s] = 0 }
$invalidStatuses = New-Object System.Collections.Generic.List[string]

foreach ($dir in $conceptDirs) {
  $reviewPath = Join-Path $dir.FullName "review.json"
  if (!(Test-Path $reviewPath -PathType Leaf)) {
    $statusCounts["missing"]++
    continue
  }
  try {
    $review = Get-Content $reviewPath -Raw | ConvertFrom-Json
    $status = $null
    if ($review.PSObject.Properties.Name -contains "status") {
      $status = [string]$review.status
    } elseif ($review.PSObject.Properties.Name -contains "review" -and
      $review.review.PSObject.Properties.Name -contains "status") {
      $status = [string]$review.review.status
    }
    if ([string]::IsNullOrWhiteSpace($status)) {
      $statusCounts["missing"]++
    } elseif ($AllowedStatuses -contains $status) {
      $statusCounts[$status]++
    } else {
      $invalidStatuses.Add("$reviewPath => $status") | Out-Null
    }
  } catch {
    $invalidStatuses.Add("$reviewPath => invalid JSON") | Out-Null
  }
}

foreach ($bad in $invalidStatuses) {
  Fail "invalid review status: $bad"
}

$totalStatuses = ($statusCounts.Values | Measure-Object -Sum).Sum
if ($totalStatuses -ne $ExpectedImages) {
  Fail "review status total expected $ExpectedImages, actual $totalStatuses"
}

"Source screenshots: $($sources.Count)"
"Concept dirs:       $($conceptDirs.Count)"
"Images:             $($images.Count)"
"Status summary:"
$statusCounts.GetEnumerator() | ForEach-Object { "  $($_.Key): $($_.Value)" }

if ($failures.Count -gt 0) {
  ""
  "FAILURES:"
  $failures | ForEach-Object { "  - $_" }
  exit 1
}

"PASS: wireframe AI concept artifacts are structurally valid."
exit 0
