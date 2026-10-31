# Read-only packet/input hash and consistency validation. No product tests/builds/workloads.
$ErrorActionPreference = 'Stop'
$p = $PSScriptRoot
$inputs = [IO.File]::ReadAllText((Join-Path $p 'inputs.json')) | ConvertFrom-Json
$g = [IO.File]::ReadAllText((Join-Path $p 'gate-matrix.json')) | ConvertFrom-Json
$manifest = [IO.File]::ReadAllText((Join-Path $p 'packet-manifest.json')) | ConvertFrom-Json
$checks = 0
function Require($condition, $message) {
    if (!$condition) { throw $message }
    $script:checks++
}
Require ($inputs.status -eq 'NOT_READY_FOR_SUBMISSION' -and $g.status -eq $inputs.status) 'Submission status mismatch'
$ids = @{}
foreach ($i in $inputs.items) {
    Require (!$ids.ContainsKey($i.id)) "Duplicate evidence id: $($i.id)"
    $ids[$i.id] = $i
    Require (Test-Path -LiteralPath $i.path -PathType Leaf) "Missing input: $($i.path)"
    $f = Get-Item -LiteralPath $i.path
    Require ($f.Length -eq $i.bytes) "Length drift: $($i.id)"
    $hash = (Get-FileHash -LiteralPath $i.path -Algorithm SHA256).Hash.ToLowerInvariant()
    Require ($hash -eq $i.sha256) "Hash drift: $($i.id)"
    if ($i.expectedSha256) { Require ($hash -eq $i.expectedSha256) "Expected hash mismatch: $($i.id)" }
}
$prereqs = [IO.File]::ReadAllText((Join-Path $p 'PREREQUISITES.md'))
$expectedGates = @('D0','D1','D2','D3') + @(0..9 | ForEach-Object {"S$_"})
Require ($g.gates.Count -eq 14) 'Expected 14 gates'
foreach ($id in $expectedGates) {
    $gate = @($g.gates | Where-Object { $_.gate -eq $id })
    Require ($gate.Count -eq 1) "Missing/duplicate gate: $id"
    Require ($gate[0].freshAcceptance -eq $false) "Unexpected fresh acceptance: $id"
    foreach ($e in $gate[0].evidenceIds) { Require ($ids.ContainsKey($e)) "Unbound evidence: $e" }
    foreach ($r in $gate[0].prerequisiteIds) { Require ($prereqs -match "(?m)^## $r —") "Unbound prerequisite: $r" }
}
foreach ($n in 1..16) { $id = 'P{0:00}' -f $n; Require ($prereqs -match "(?m)^## $id —") "Missing prerequisite: $id" }
Require ($g.d1.verdict -eq 'AMEND' -and $g.d1.prerequisiteStatus -eq 'BLOCKED') 'D1 incorrectly accepted'
Require ($g.d1.mf6.status -eq 'FAIL' -and $g.d1.mf6.marginalP95DifferenceMs -eq 30.1605 -and $g.d1.mf6.thresholdMs -eq 20) 'MF6 retained failure mismatch'
Require ($g.d1.newP1.Count -eq 2) 'Missing P1 blockers'
Require (($g.gates | Where-Object gate -eq 'S5').status -eq 'FAIL' -and $g.abV2.savings -eq 'NOT_PROVEN') 'S5 incorrectly accepted'
Require (($g.gates | Where-Object gate -eq 'S7').status -eq 'BLOCKED') 'Historical soak promoted to current pass'
Require (!$g.d2TurnId -and !$g.d3TurnId -and !$g.abV2.executionAuthorized -and !$g.abV2.registrationDigest -and !$g.abV2.analysisSeed -and !$g.abV2.holdoutManifest) 'Invented review/seal/execution binding'
Require (!$g.sourceBinding.currentWriterFrozenManifest -and !$g.sourceBinding.newDevicePackage -and !$g.sourceBinding.newPalacePackage) 'Invented new source/artifact freeze'
Require ($ids['d1-source-manifest'].sha256 -eq $g.sourceBinding.reviewedSnapshotManifestSha256) 'D1 snapshot hash mismatch'
Require ($g.sourceTestOwner -eq 'del_mvrbs779_bgcp') 'Source owner mismatch'
foreach ($a in $g.actions.PSObject.Properties) { Require ($a.Value -eq $false) "Unauthorized action flag: $($a.Name)" }
foreach ($entry in $manifest.files) {
    $path = Join-Path $p $entry.file
    Require (Test-Path -LiteralPath $path -PathType Leaf) "Missing packet file: $($entry.file)"
    Require ((Get-Item -LiteralPath $path).Length -eq $entry.bytes) "Packet length drift: $($entry.file)"
    Require ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -eq $entry.sha256) "Packet hash drift: $($entry.file)"
}
$covered = @($manifest.files.file) + @('packet-manifest.json','verification.json')
foreach ($f in Get-ChildItem -LiteralPath $p -File) { Require ($f.Name -in $covered) "Unmanifested packet file: $($f.Name)" }
foreach ($f in Get-ChildItem -LiteralPath $p -Filter '*.md' -File) {
    $text = [IO.File]::ReadAllText($f.FullName)
    Require ($text.Contains('NOT_READY_FOR_SUBMISSION')) "Missing blocked label: $($f.Name)"
    foreach ($m in [regex]::Matches($text, '\]\(([^)]+)\)')) {
        $target = $m.Groups[1].Value.Split('#')[0]
        if ($target -and $target -notmatch '^https?://') { Require (Test-Path -LiteralPath (Join-Path $p $target)) "Broken local link: $target" }
    }
}
[ordered]@{
    status = 'PASS_PACKET_INTEGRITY_ONLY'
    packetStatus = 'NOT_READY_FOR_SUBMISSION'
    checkedAt = [DateTime]::UtcNow.ToString('o')
    checks = $checks
    indexedInputFiles = $inputs.items.Count
    historicalProviderEventFiles = @($inputs.items | Where-Object classification -eq 'HISTORICAL_RAW_PROVIDER_EVENTS').Count
    packetPayloadFiles = $manifest.files.Count
    packetManifestSha256 = (Get-FileHash -LiteralPath (Join-Path $p 'packet-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
    limitations = 'File/hash/link/declared-state consistency only. No builds/tests/workloads, raw telemetry recomputation, current source freeze, independent review, privacy clearance or acceptance. verification.json is excluded from self-hashing; rerun this read-only verifier for fresh evidence.'
} | ConvertTo-Json -Depth 6
