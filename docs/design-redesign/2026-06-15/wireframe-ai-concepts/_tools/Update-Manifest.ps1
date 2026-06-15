param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$OutputRoot
)

function To-RepoRelative($path) {
  $full = (Resolve-Path -LiteralPath $path).Path
  $repo = (Resolve-Path -LiteralPath $RepoRoot).Path.TrimEnd('\')
  return ($full.Substring($repo.Length + 1) -replace '\\', '/')
}

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

$sourceRoot = Join-Path $RepoRoot 'docs/Wireframe'
$manifestPath = Join-Path $OutputRoot 'manifest.json'
$sources = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter 'browser-screenshot--*--desktop.png' |
  Sort-Object FullName

$summary = [ordered]@{
  accepted = 0
  generated_with_issues = 0
  rejected = 0
  failed = 0
  missing = 0
}

$states = @()
foreach ($source in $sources) {
  $page = Split-Path $source.DirectoryName -Leaf
  $state = $source.BaseName -replace '^browser-screenshot--', '' -replace '--desktop$', ''
  $stateId = "${page}__${state}__desktop"
  $screenType = Get-ScreenType $page $state
  $stateOutputRel = "$page/$state"
  $stateOutputAbs = Join-Path $OutputRoot ($stateOutputRel -replace '/', '\')
  $descriptionAbs = Join-Path $source.DirectoryName 'description.md'
  $functionalAbs = Join-Path $source.DirectoryName 'functional-spec.md'

  $concepts = @()
  foreach ($idx in 1..3) {
    $localConceptId = "concept-{0:D2}" -f $idx
    $globalConceptId = "${stateId}__c{0:D2}" -f $idx
    $prefix = "$stateOutputRel/$localConceptId"
    $imageRel = "$prefix/image.png"
    $promptRel = "$prefix/prompt.json"
    $metaRel = "$prefix/meta.json"
    $reviewRel = "$prefix/review.json"
    $reviewAbs = Join-Path $OutputRoot ($reviewRel -replace '/', '\')
    $status = 'missing'
    $validation = 'missing'
    $issueCodes = @('MISSING_IMAGE')

    if (Test-Path -LiteralPath (Join-Path $OutputRoot ($imageRel -replace '/', '\')) -PathType Leaf) {
      $status = 'generated_with_issues'
      $validation = 'needs_review'
      $issueCodes = @('MISSING_REVIEW')
      if (Test-Path -LiteralPath $reviewAbs -PathType Leaf) {
        try {
          $review = Get-Content -LiteralPath $reviewAbs -Raw | ConvertFrom-Json
          if ($review.PSObject.Properties.Name -contains 'status' -and -not [string]::IsNullOrWhiteSpace($review.status)) {
            $status = [string]$review.status
          }
          if ($review.PSObject.Properties.Name -contains 'validation' -and -not [string]::IsNullOrWhiteSpace($review.validation)) {
            $validation = [string]$review.validation
          }
          if ($review.PSObject.Properties.Name -contains 'issueCodes' -and $review.issueCodes) {
            $issueCodes = @($review.issueCodes | ForEach-Object { [string]$_ })
          } else {
            $issueCodes = @()
          }
        } catch {
          $status = 'generated_with_issues'
          $validation = 'invalid_review_json'
          $issueCodes = @('INVALID_REVIEW_JSON')
        }
      }
    }

    if (-not $summary.Contains($status)) { $summary[$status] = 0 }
    $summary[$status]++

    $concepts += [pscustomobject]@{
      conceptIndex = $idx
      conceptId = $globalConceptId
      localConceptId = $localConceptId
      imagePath = $imageRel
      promptPath = $promptRel
      metaPath = $metaRel
      reviewPath = $reviewRel
      status = $status
      validation = $validation
      issueCodes = $issueCodes
    }
  }

  $states += [pscustomobject]@{
    stateId = $stateId
    pageSlug = $page
    stateName = $state
    viewport = 'desktop'
    screenType = $screenType
    sourceScreenshotPath = To-RepoRelative $source.FullName
    descriptionPath = if (Test-Path -LiteralPath $descriptionAbs -PathType Leaf) { To-RepoRelative $descriptionAbs } else { $null }
    functionalSpecPath = if (Test-Path -LiteralPath $functionalAbs -PathType Leaf) { To-RepoRelative $functionalAbs } else { $null }
    outputPath = $stateOutputRel
    mustPreserveStateSignals = Get-StateSignals $page $state
    concepts = $concepts
  }
}

$actualImageCount = @(Get-ChildItem -LiteralPath $OutputRoot -Recurse -File -Filter 'image.png').Count
$expectedImageCount = $sources.Count * 3
$status = if ($actualImageCount -eq $expectedImageCount -and $summary.missing -eq 0 -and $summary.failed -eq 0) { 'complete' } elseif ($actualImageCount -gt 0) { 'partial' } else { 'pending' }

$manifest = [pscustomobject]@{
  schemaVersion = '1.0'
  runId = '2026-06-15-wireframe-ai-concepts'
  createdAt = (Get-Date).ToString('o')
  designSource = 'DESIGN.md'
  promptStandards = '_tools/prompt-standards.md'
  sourceRoot = 'docs/Wireframe'
  outputRoot = 'docs/design-redesign/2026-06-15/wireframe-ai-concepts'
  viewport = 'desktop'
  targetSelector = 'docs/Wireframe/**/browser-screenshot--*--desktop.png'
  sourceStateCount = $sources.Count
  conceptsPerState = 3
  expectedImageCount = $expectedImageCount
  actualImageCount = $actualImageCount
  status = $status
  notes = @(
    'Generated images are visual direction bitmap assets, not final UI copy sources.',
    'Source screenshots, docs, source code, and theme files are not modified.',
    'All prompts must enforce edge-to-edge app UI only: no browser chrome, OS window title bar, device frame, or watermark.'
  )
  states = $states
  summary = $summary
}

$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

[pscustomobject]@{
  manifest = $manifestPath
  sourceStateCount = $sources.Count
  expectedImageCount = $expectedImageCount
  actualImageCount = $actualImageCount
  status = $status
  summary = $summary
}
