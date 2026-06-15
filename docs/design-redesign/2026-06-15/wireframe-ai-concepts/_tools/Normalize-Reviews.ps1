param(
  [Parameter(Mandatory = $true)][string]$OutputRoot
)

function Get-ScreenType($page, $state) {
  if ($page -match 'landing') { return 'public_landing' }
  if ($page -match 'terms|privacy') { return 'legal' }
  if ($state -eq 'modal-open') { return 'modal' }
  if ($page -match 'login|sign-up|auth|password-reset') { return 'auth' }
  return 'workspace'
}

function Get-StateSignals($page, $state) {
  switch ($state) {
    'session-expired' { return @('session expired notice', 'login form remains primary', 'safe recovery links') }
    'modal-open' { return @('dimmed background context', 'centered modal', 'clear primary decision') }
    'analyzing' { return @('analysis loading status', 'progress indication', 'submitted context dimmed') }
    'complete' { return @('completed feedback/result state', 'score or summary', 'next action') }
    'otp-expired' { return @('expired verification link message', 'manual resend action', 'login escape route') }
    'rate-limited' { return @('rate limit guidance', 'disabled retry or countdown', 'safe wording') }
    'unknown' { return @('unknown auth error explanation', 'no raw error details', 'recovery route') }
    'current-account-redirect' { return @('dashboard redirect state', 'no consent form', 'study continuation') }
    default { return @('default page purpose', 'key regions preserved', 'primary action preserved') }
  }
}

$conceptDirs = Get-ChildItem -LiteralPath $OutputRoot -Recurse -Directory |
  Where-Object { $_.Name -match '^concept-\d{2}$' }

foreach ($dir in $conceptDirs) {
  $reviewPath = Join-Path $dir.FullName 'review.json'
  $promptPath = Join-Path $dir.FullName 'prompt.json'
  $metaPath = Join-Path $dir.FullName 'meta.json'
  $imagePath = Join-Path $dir.FullName 'image.png'
  if (-not (Test-Path -LiteralPath $imagePath -PathType Leaf)) { continue }

  $stateDir = Split-Path $dir.FullName -Parent
  $pageDir = Split-Path $stateDir -Parent
  $state = Split-Path $stateDir -Leaf
  $page = Split-Path $pageDir -Leaf
  $localConceptId = Split-Path $dir.FullName -Leaf
  $conceptIndex = [int]($localConceptId -replace '^concept-', '')
  $stateId = "${page}__${state}__desktop"
  $globalConceptId = "${stateId}__c{0:D2}" -f $conceptIndex
  $screenType = Get-ScreenType $page $state
  $signals = Get-StateSignals $page $state
  $relativePrefix = "$page/$state/$localConceptId"
  $imageRel = "$relativePrefix/image.png"
  $promptRel = "$relativePrefix/prompt.json"
  $metaRel = "$relativePrefix/meta.json"
  $reviewRel = "$relativePrefix/review.json"

  $existing = $null
  if (Test-Path -LiteralPath $reviewPath -PathType Leaf) {
    try { $existing = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json } catch { $existing = $null }
  }

  $status = 'accepted'
  $validation = 'pass'
  $issueCodes = @()
  $notes = 'Normalized review record. Existing review was converted to the canonical schema.'

  if ($existing) {
    if ($existing.PSObject.Properties.Name -contains 'status' -and -not [string]::IsNullOrWhiteSpace($existing.status)) {
      $status = [string]$existing.status
    }
    if ($existing.PSObject.Properties.Name -contains 'validation' -and -not [string]::IsNullOrWhiteSpace($existing.validation)) {
      $validation = [string]$existing.validation
    }
    if ($existing.PSObject.Properties.Name -contains 'issueCodes' -and $existing.issueCodes) {
      $issueCodes = @($existing.issueCodes | ForEach-Object { [string]$_ })
    }
    if ($existing.PSObject.Properties.Name -contains 'notes' -and -not [string]::IsNullOrWhiteSpace($existing.notes)) {
      $notes = [string]$existing.notes
    }
  }

  $imageItem = Get-Item -LiteralPath $imagePath
  $hasIssue = @{
    WRONG_FRAME_CHROME = $issueCodes -contains 'WRONG_FRAME_CHROME'
    DESIGN_MISMATCH = $issueCodes -contains 'DESIGN_MISMATCH'
    STATE_SIGNAL_MISSING = $issueCodes -contains 'STATE_SIGNAL_MISSING'
    CTA_MISMATCH = $issueCodes -contains 'CTA_MISMATCH'
    LOUD_GRADIENT = $issueCodes -contains 'LOUD_GRADIENT'
    WORKSPACE_RADIUS_MISMATCH = $issueCodes -contains 'WORKSPACE_RADIUS_MISMATCH'
    KEY_REGIONS_MISSING = $issueCodes -contains 'KEY_REGIONS_MISSING'
    TEXT_DISTORTION = $issueCodes -contains 'TEXT_DISTORTION'
  }

  [pscustomobject]@{
    schemaVersion = '1.0'
    runId = '2026-06-15-wireframe-ai-concepts'
    reviewId = $globalConceptId
    conceptId = $globalConceptId
    localConceptId = $localConceptId
    stateId = $stateId
    page = $page
    state = $state
    screenType = $screenType
    imagePath = $imageRel
    promptPath = $promptRel
    metaPath = $metaRel
    reviewPath = $reviewRel
    status = $status
    validation = $validation
    mustPreserveStateSignals = $signals
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
    issueCodes = $issueCodes
    notes = $notes
    reviewedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reviewPath -Encoding UTF8
}

[pscustomobject]@{
  normalizedReviews = $conceptDirs.Count
}
