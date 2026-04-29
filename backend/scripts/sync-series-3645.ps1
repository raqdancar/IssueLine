param(
  [string]$HeroSlug = 'doctor-strange',
  [int]$HeroApiId = 226,
  [int]$SeriesId = 3645,
  [switch]$SkipNewsstand = $true
)

$ErrorActionPreference = 'Stop'

function Get-DotEnvValueMap {
  param([string]$Path)
  $map = @{}
  if (!(Test-Path $Path)) {
    throw "Unable to locate .env file at $Path"
  }
  foreach ($rawLine in Get-Content $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $parts = $line -split '=', 2
    if ($parts.Length -ne 2) { continue }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($key) { $map[$key] = $value }
  }
  return $map
}

function New-BasicAuthHeader {
  param([string]$Username, [string]$Password)
  if (-not $Username -or -not $Password) { return $null }
  $token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${Username}:${Password}"))
  return "Basic $token"
}

function Normalize-SeriesName {
  param([string]$Value)
  if ($null -eq $Value) { return $null }
  $trimmed = $Value.Trim()
  if (-not $trimmed) { return '' }
  switch ($trimmed) {
    'Doctor Strange (1968 series)' { return 'Doctor Strange 1968' }
    'Doctor Strange (1974 series)' { return 'Doctor Strange 1974' }
    default { return $trimmed }
  }
}

function Normalize-CoverUrl {
  param([string]$Url, [string]$SizeToken = 'w200')
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  try {
    $uri = [Uri]$Url
    $builder = [System.UriBuilder]::new($uri)
    $cleanPath = $builder.Path -replace '/{2,}', '/'
    $cleanPath = $cleanPath.TrimStart('/')
    $cleanPath = '/' + ([regex]::Replace($cleanPath, '/w\d+/', "/$SizeToken/"))
    $builder.Path = $cleanPath
    return $builder.Uri.AbsoluteUri
  } catch {
    $temp = $Url -replace '://', '__SCHEME__'
    $temp = $temp -replace '/{2,}', '/'
    $temp = $temp -replace '__SCHEME__', '://'
    return [regex]::Replace($temp, '/w\d+/', "/$SizeToken/")
  }
}

function ConvertTo-IsoDate {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $trimmed = $Value.Trim()
  if ($trimmed -match '^(\d{4})-(\d{2})-(\d{2})$') {
    $year = [int]$matches[1]
    $year = [Math]::Max(1, $year)
    $month = [int]$matches[2]
    $day = [int]$matches[3]
    $month = [Math]::Max(1, [Math]::Min(12, $month))
    $maxDay = [DateTime]::DaysInMonth($year, $month)
    $day = [Math]::Max(1, [Math]::Min($maxDay, $day))
    return [DateTime]::new($year, $month, $day).ToString('yyyy-MM-dd')
  } elseif ($trimmed -match '^(\d{4})-(\d{2})$') {
    $year = [int]$matches[1]
    $year = [Math]::Max(1, $year)
    $month = [int]$matches[2]
    $month = [Math]::Max(1, [Math]::Min(12, $month))
    return [DateTime]::new($year, $month, 1).ToString('yyyy-MM-dd')
  } elseif ($trimmed -match '^(\d{4})$') {
    $year = [int]$matches[1]
    $year = [Math]::Max(1, $year)
    return [DateTime]::new($year, 1, 1).ToString('yyyy-MM-dd')
  }
  try {
    return (Get-Date $trimmed -Format 'yyyy-MM-dd')
  } catch {
    return $null
  }
}

function Get-IssueIdFromUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  $match = [regex]::Match($Url, '/issue/(\d+)/')
  if ($match.Success) { return [int]$match.Groups[1].Value }
  return $null
}

function Get-SeriesIdFromIssue {
  param($Issue)
  if ($Issue.series_id) { return [int]$Issue.series_id }
  if ($Issue.series) {
    $match = [regex]::Match($Issue.series, '/series/(\d+)/')
    if ($match.Success) { return [int]$match.Groups[1].Value }
  }
  return $null
}

function Get-PreferredDate {
  param($Issue)
  foreach ($field in @('key_date','on_sale_date','publication_date')) {
    $value = $Issue.$field
    if ($value) { return $value }
  }
  return $null
}

function Build-IssueHeadline {
  param([string]$SeriesName, [string]$IssueCode, [string]$Number, [string]$Fallback)
  $normalizedSeries = Normalize-SeriesName $SeriesName
  $normalizedSeries = if ($normalizedSeries) { $normalizedSeries } elseif ($SeriesName) { $SeriesName.Trim() } else { '' }
  $strip = {
    param($val)
    if ([string]::IsNullOrWhiteSpace($val)) { return '' }
    return ($val -replace '^#+', '').Trim()
  }
  $normalizedNumber = & $strip $Number
  $normalizedCode = if ($normalizedNumber) { $normalizedNumber } else { & $strip $IssueCode }
  if ($normalizedSeries -and $normalizedCode) { return "$normalizedSeries #$normalizedCode" }
  if ($normalizedSeries) { return $normalizedSeries }
  if ($normalizedCode) { return "Issue #$normalizedCode" }
  return (if ($Fallback) { $Fallback } else { 'Issue' })
}

function Should-IncludeDescriptor {
  param([string]$Descriptor, [switch]$SkipNewsstand)
  if ([string]::IsNullOrWhiteSpace($Descriptor)) { return $true }
  if ($SkipNewsstand -and $Descriptor -match '(?i)newsstand|newstand') { return $false }
  return $true
}

function ConvertTo-IntOrNull {
  param($Value)
  if ($null -eq $Value) { return $null }
  if ($Value -is [int]) { return $Value }
  $text = "$Value".Trim()
  if (-not $text) { return $null }
  if ($text -match '^\d+(\.\d+)?$') {
    return [int][math]::Truncate([double]$text)
  }
  $match = [regex]::Match($text, '\d+')
  if ($match.Success) { return [int]$match.Value }
  return $null
}

function Map-ToIssueRow {
  param($HeroApiId, $Issue)
  $issueId = Get-IssueIdFromUrl $Issue.api_url
  $seriesId = Get-SeriesIdFromIssue $Issue
  $issueDate = ConvertTo-IsoDate (Get-PreferredDate $Issue)
  $normalizedSeries = Normalize-SeriesName $Issue.series_name
  $normalizedNumber = ConvertTo-IntOrNull $Issue.number
  $normalizedPages = ConvertTo-IntOrNull $Issue.page_count
  return [ordered]@{
    hero_api_id = $HeroApiId
    gcd_issue_id = $issueId
    series_id = $seriesId
    series_name = if ($normalizedSeries) { $normalizedSeries } else { $Issue.series_name }
    number = $normalizedNumber
    volume = $Issue.volume
    title = $Issue.title
    key_date = $Issue.key_date
    on_sale_date = ConvertTo-IsoDate $Issue.on_sale_date
    publication_date = $Issue.publication_date
    issue_date = $issueDate
    price = $Issue.price
    page_count = $normalizedPages
    cover = Normalize-CoverUrl $Issue.cover
    cover_original = $Issue.cover
    raw = $Issue
  }
}

function Map-ToTimelineEntry {
  param($HeroApiId, $Issue)
  $issueId = Get-IssueIdFromUrl $Issue.api_url
  $issueDate = ConvertTo-IsoDate (Get-PreferredDate $Issue)
  if (-not $issueDate) { return $null }
  $normalizedSeries = Normalize-SeriesName $Issue.series_name
  $coverSmall = Normalize-CoverUrl $Issue.cover
  $descriptorLabel = if ($Issue.descriptor) { $Issue.descriptor } elseif ($Issue.number) { $Issue.number } else { 'Issue' }
  $issueLabel = if ($normalizedSeries) { "$normalizedSeries $descriptorLabel".Trim() } else { $descriptorLabel }
  $headline = Build-IssueHeadline -SeriesName $normalizedSeries -IssueCode $Issue.descriptor -Number $Issue.number -Fallback $issueLabel
  $entry = [ordered]@{
    hero_api_id = $HeroApiId
    issue_date = $issueDate
    headline = $headline
    summary = if ($Issue.notes) { $Issue.notes.Trim() } elseif ($Issue.publication_date) { $Issue.publication_date } else { $null }
    issue_code = if ($Issue.descriptor) { $Issue.descriptor } elseif ($Issue.number) { $Issue.number } else { $issueLabel }
    source_url = if ($Issue.api_url) { $Issue.api_url.Replace('?format=json','') } else { $null }
    severity = 'info'
    metadata = [ordered]@{
      gcdIssueId = $issueId
      issueLabel = $issueLabel
      number = $Issue.number
      volume = $Issue.volume
      keyDate = $Issue.key_date
      key_date = $Issue.key_date
      publicationDate = $Issue.publication_date
      publication_date = $Issue.publication_date
      onSaleDate = $Issue.on_sale_date
      on_sale_date = $Issue.on_sale_date
      apiUrl = $Issue.api_url
      cover = $coverSmall
      cover_original = $Issue.cover
      seriesName = $normalizedSeries
      series_name = $normalizedSeries
      seriesNameRaw = $Issue.series_name
      series_name_raw = $Issue.series_name
      price = $Issue.price
      pageCount = $Issue.page_count
      page_count = $Issue.page_count
      editing = $Issue.editing
      rating = $Issue.rating
      coverImagePath = $Issue.cover_image_path
      cover_image_path = $Issue.cover_image_path
    }
  }
  return $entry
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$repoRoot = Split-Path -Parent $backendDir
$envPath = Join-Path $repoRoot '.env'
$envMap = Get-DotEnvValueMap -Path $envPath

$gcdBase = $envMap['GCD_BASE_URL']
$gcdUser = $envMap['GCD_USERNAME']
$gcdPass = $envMap['GCD_PASSWORD']
$supabaseUrl = $envMap['VITE_SUPABASE_URL']
$supabaseKey = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $gcdBase -or -not $supabaseUrl -or -not $supabaseKey) {
  throw 'Missing required environment configuration.'
}
$gcdApiBase = ($gcdBase.TrimEnd('/') + '/api')
$authHeader = New-BasicAuthHeader -Username $gcdUser -Password $gcdPass
$gcdHeaders = @{
  'User-Agent' = 'issueline-manual-sync/0.1'
  Accept = 'application/json'
}
if ($authHeader) { $gcdHeaders['Authorization'] = $authHeader }

function Invoke-Gcd {
  param([string]$Path)
  $uri = $Path
  if (-not $Path.StartsWith('http')) {
    $normalized = $Path.TrimStart('/')
    $uri = "$gcdApiBase/$normalized"
  }
  if ($uri -notmatch 'format=') {
    if ($uri -match '\?') { $separator = '&' } else { $separator = '?' }
    $uri = "$uri${separator}format=json"
  }
  return Invoke-RestMethod -Uri $uri -Headers $gcdHeaders -TimeoutSec 120
}

Write-Output "Loading series $SeriesId..."
$series = Invoke-Gcd -Path "series/$SeriesId/"
$issues = @()
for ($i = 0; $i -lt $series.active_issues.Count; $i++) {
  $descriptor = $series.issue_descriptors[$i]
  if (-not (Should-IncludeDescriptor -Descriptor $descriptor -SkipNewsstand:$SkipNewsstand)) { continue }
  $issues += [pscustomobject]@{
    Descriptor = $descriptor
    Url = $series.active_issues[$i]
  }
}

Write-Output "Fetching $($issues.Count) filtered issues..."
$fetchedIssues = @()
foreach ($entry in $issues) {
  $issuePayload = Invoke-Gcd -Path $entry.Url
  $issuePayload | Add-Member -NotePropertyName descriptor -NotePropertyValue $entry.Descriptor -Force
  $fetchedIssues += $issuePayload
  Start-Sleep -Seconds 4
}

$issueRows = @()
$fetchedIssues | ForEach-Object {
  $issueRows += (Map-ToIssueRow -HeroApiId $HeroApiId -Issue $_)
}

$baseHeaders = @{
  apikey = $supabaseKey
  Authorization = "Bearer $supabaseKey"
  'Content-Type' = 'application/json'
  'Accept-Profile' = 'public'
}

Write-Output 'Loading existing timeline gcdIssueIds...'
$timelineExisting = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/hero_timelines?hero_api_id=eq.$HeroApiId&select=gcdIssueId:metadata->>gcdIssueId" -Headers $baseHeaders
$existingSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($row in $timelineExisting) {
  $id = $row.gcdIssueId
  if ($id) { $existingSet.Add($id) | Out-Null }
}

$timelineRows = @()
foreach ($issue in $fetchedIssues) {
  $entry = Map-ToTimelineEntry -HeroApiId $HeroApiId -Issue $issue
  if (-not $entry) { continue }
  $gcdId = [string](Get-IssueIdFromUrl $issue.api_url)
  if ($existingSet.Contains($gcdId)) { continue }
  $existingSet.Add($gcdId) | Out-Null
  $timelineRows += $entry
}

function Submit-Batch {
  param(
    [string]$Table,
    [array]$Rows,
    [string]$Prefer,
    [string]$OnConflict,
    [switch]$IgnoreConflict
  )
  if (-not $Rows -or -not $Rows.Count) { return 0 }
  $batchSize = 20
  $inserted = 0
  for ($offset = 0; $offset -lt $Rows.Count; $offset += $batchSize) {
    $chunk = $Rows[$offset..([Math]::Min($Rows.Count - 1, $offset + $batchSize - 1))]
    $headers = $baseHeaders.Clone()
    if ($Prefer) { $headers['Prefer'] = $Prefer }
    $json = $chunk | ConvertTo-Json -Depth 20
    $uri = "$supabaseUrl/rest/v1/$Table"
    if ($OnConflict) {
      $uri = "$uri?on_conflict=$OnConflict"
    }
    try {
      $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $json -TimeoutSec 120
      if ($response) {
        if ($response -is [array]) { $inserted += $response.Count } else { $inserted += 1 }
      }
    } catch {
      $statusCode = $null
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
      }
      if ($IgnoreConflict -and $statusCode -eq 409) {
        Write-Warning "Conflict while inserting $Table batch - assuming rows already exist and continuing."
        continue
      }
      throw
    }
  }
  return $inserted
}

Write-Output "Upserting $($issueRows.Count) hero_issues rows..."
$issuesInserted = Submit-Batch -Table 'hero_issues' -Rows $issueRows -Prefer 'resolution=merge-duplicates,return=representation' -OnConflict 'hero_api_id,gcd_issue_id'
Write-Output "Prepared $($timelineRows.Count) new timeline rows..."
if ($timelineRows.Count) {
  $timelineInserted = Submit-Batch -Table 'hero_timelines' -Rows $timelineRows -Prefer 'return=representation'
} else {
  $timelineInserted = 0
}

Write-Output "Hero issues upserted: $issuesInserted"
Write-Output "Timeline entries inserted: $timelineInserted"
