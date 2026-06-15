param(
  [Parameter(Mandatory = $true)][string]$OutputRoot,
  [Parameter(Mandatory = $true)][string]$GeneratedRoot,
  [Parameter(Mandatory = $true)][string]$Page,
  [Parameter(Mandatory = $true)][string]$State,
  [string]$ScreenType = "workspace",
  [string[]]$MustPreserveStateSignals = @(),
  [Parameter(Mandatory = $true)][ValidateRange(1, 3)][int]$ConceptIndex,
  [Parameter(Mandatory = $true)][string]$Prompt,
  [Parameter(Mandatory = $true)][string]$Status,
  [Parameter(Mandatory = $true)][string]$Validation,
  [string[]]$IssueCodes = @(),
  [string]$Notes = "",
  [string]$Generator = "codex imagegen built-in"
)

$conceptId = "concept-{0:D2}" -f $ConceptIndex
$stateId = "${Page}__${State}__desktop"
$globalConceptId = "${stateId}__c{0:D2}" -f $ConceptIndex
$conceptDir = Join-Path $OutputRoot (Join-Path $Page (Join-Path $State $conceptId))
New-Item -ItemType Directory -Force -Path $conceptDir | Out-Null

$latest = Get-ChildItem -LiteralPath $GeneratedRoot -Filter "*.png" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latest) {
  throw "No generated PNG found in $GeneratedRoot"
}

$imagePath = Join-Path $conceptDir "image.png"
Copy-Item -LiteralPath $latest.FullName -Destination $imagePath -Force
$imageItem = Get-Item -LiteralPath $imagePath
$relativePrefix = "$Page/$State/$conceptId"
$imageRel = "$relativePrefix/image.png"
$promptRel = "$relativePrefix/prompt.json"
$metaRel = "$relativePrefix/meta.json"
$reviewRel = "$relativePrefix/review.json"

[pscustomobject]@{
  schemaVersion = "1.0"
  runId = "2026-06-15-wireframe-ai-concepts"
  conceptId = $conceptId
  globalConceptId = $globalConceptId
  stateId = $stateId
  page = $Page
  state = $State
  screenType = $ScreenType
  prompt = $Prompt
} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $conceptDir "prompt.json") -Encoding UTF8

[pscustomobject]@{
  schemaVersion = "1.0"
  runId = "2026-06-15-wireframe-ai-concepts"
  conceptId = $conceptId
  globalConceptId = $globalConceptId
  stateId = $stateId
  generatedAt = (Get-Date).ToString("o")
  sourceGeneratedImage = $latest.FullName
  copiedTo = $imageRel
  generator = $Generator
} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $conceptDir "meta.json") -Encoding UTF8

$hasIssue = @{
  WRONG_FRAME_CHROME = $IssueCodes -contains "WRONG_FRAME_CHROME"
  DESIGN_MISMATCH = $IssueCodes -contains "DESIGN_MISMATCH"
  STATE_SIGNAL_MISSING = $IssueCodes -contains "STATE_SIGNAL_MISSING"
  CTA_MISMATCH = $IssueCodes -contains "CTA_MISMATCH"
  LOUD_GRADIENT = $IssueCodes -contains "LOUD_GRADIENT"
  WORKSPACE_RADIUS_MISMATCH = $IssueCodes -contains "WORKSPACE_RADIUS_MISMATCH"
  KEY_REGIONS_MISSING = $IssueCodes -contains "KEY_REGIONS_MISSING"
  TEXT_DISTORTION = $IssueCodes -contains "TEXT_DISTORTION"
}

[pscustomobject]@{
  schemaVersion = "1.0"
  runId = "2026-06-15-wireframe-ai-concepts"
  reviewId = $globalConceptId
  conceptId = $globalConceptId
  localConceptId = $conceptId
  stateId = $stateId
  page = $Page
  state = $State
  screenType = $ScreenType
  imagePath = $imageRel
  promptPath = $promptRel
  metaPath = $metaRel
  reviewPath = $reviewRel
  status = $Status
  validation = $Validation
  mustPreserveStateSignals = $MustPreserveStateSignals
  checks = [pscustomobject]@{
    fileExists = $true
    nonZeroBytes = ($imageItem.Length -gt 0)
    noChrome = (-not $hasIssue.WRONG_FRAME_CHROME)
    stateSignalPreserved = (-not $hasIssue.STATE_SIGNAL_MISSING)
    primaryCtaDarkOnly = (-not $hasIssue.CTA_MISMATCH)
    neutralPaletteOnly = (-not $hasIssue.DESIGN_MISMATCH)
    workspaceRadiusOk = (-not $hasIssue.WORKSPACE_RADIUS_MISMATCH)
    noLoudGradient = (-not $hasIssue.LOUD_GRADIENT)
    keyRegionsPreserved = (-not $hasIssue.KEY_REGIONS_MISSING)
    textUsableAsVisualReference = (-not $hasIssue.TEXT_DISTORTION)
  }
  issueCodes = $IssueCodes
  notes = $Notes
  reviewedAt = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $conceptDir "review.json") -Encoding UTF8

$imageItem | Select-Object FullName, Length, LastWriteTime
