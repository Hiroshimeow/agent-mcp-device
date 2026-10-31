# Evidence integrity only. No product test/build/performance execution.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = [Text.UTF8Encoding]::new($false)
function Get-EvidenceSHA256($path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Save-EvidenceJSON($name,$value) { [IO.File]::WriteAllText((Join-Path $root $name),($value | ConvertTo-Json -Depth 12),$utf8) }
$checks = [Collections.Generic.List[object]]::new()
function Add-EvidenceCheck($name,$pass,$detail) { $checks.Add([ordered]@{name=$name;pass=[bool]$pass;detail=$detail}) }
$manifest = [IO.File]::ReadAllText((Join-Path $root 'stable-source-manifest.json')) | ConvertFrom-Json
$packet = [IO.File]::ReadAllText((Join-Path $root 'packet-manifest.json')) | ConvertFrom-Json
$drift = @($manifest | Where-Object { (Get-EvidenceSHA256 $_.path) -ne $_.sha256 })
Add-EvidenceCheck '420 current source hashes' ($manifest.Count -eq 420 -and !$drift.Count) 'Read-only hash comparison, not product tests'
Add-EvidenceCheck 'packet manifest identity' ((Get-EvidenceSHA256 (Join-Path $root 'packet-manifest.json')) -eq 'c3ad3630b378d5bc3e4a919556c48a656eb19ae3535427ef5fc7c36093970c42') 'Matches durable handoff'
$files = @($packet.sourceParts | ForEach-Object { $_.file }) + @($packet.evidenceContent,$packet.omissions,$packet.prompt)
foreach ($file in $files) {
    $path = Join-Path $root $file.path
    Add-EvidenceCheck ('attachment '+$file.path) (((Get-EvidenceSHA256 $path) -eq $file.sha256) -and ((Get-Item -LiteralPath $path).Length -eq $file.bytes)) $file.sha256
}
$included = @($packet.sourceParts | ForEach-Object { $_.sourcePaths })
$omitted = @([IO.File]::ReadAllText((Join-Path $root 'packet/omitted-source-content.json')) | ConvertFrom-Json)
$all = @($included) + @($omitted.path)
Add-EvidenceCheck 'coverage partition' ($included.Count -eq 410 -and $omitted.Count -eq 10 -and @($all | Sort-Object -Unique).Count -eq 420 -and @(Compare-Object ($manifest.path | Sort-Object) ($all | Sort-Object)).Count -eq 0) '410 full text +10 explicit hash-only exclusions'
foreach ($part in $packet.sourceParts) {
    $text = [IO.File]::ReadAllText((Join-Path $root $part.file.path))
    foreach ($path in $part.sourcePaths) {
        $source = $manifest | Where-Object path -eq $path
        $original = [Text.UTF8Encoding]::new($false,$true).GetString([IO.File]::ReadAllBytes((Join-Path (Get-Location) $path)))
        $block = "===== BEGIN SOURCE $path | original-bytes=$((Get-Item -LiteralPath $path).Length) | sha256=$($source.sha256) =====`n$original`n===== END SOURCE $path ====="
        Add-EvidenceCheck ('source content '+$path) ($text.Contains($block)) 'Complete UTF-8 original text content present'
    }
}
$evidence = [IO.File]::ReadAllText((Join-Path $root 'packet/evidence-content.txt'))
foreach ($file in $packet.evidenceFiles) {
    $original = [IO.File]::ReadAllText($file.path)
    $block = "===== BEGIN EVIDENCE $($file.path) | original-bytes=$($file.bytes) | sha256=$($file.sha256) =====`n$original`n===== END EVIDENCE $($file.path) ====="
    Add-EvidenceCheck ('evidence '+$file.path) (((Get-EvidenceSHA256 $file.path) -eq $file.sha256) -and $evidence.Contains($block)) 'Complete historical raw evidence content present'
}
Add-EvidenceCheck 'historical response exact bytes' ((Get-EvidenceSHA256 (Join-Path $root 'recovered/response.md')) -eq 'e901a780bb44e8f345c81a78edaee3fe37af712bb38178d9b971defceb2eafd8') 'Remote/local SHA256 match;13883 bytes'
Add-EvidenceCheck 'historical state exact bytes' ((Get-EvidenceSHA256 (Join-Path $root 'recovered/state.json')) -eq '4999e2fd715b25d1e2aabfbf48e83a531abc91830323f8ef60076af1ea33c999') 'Remote/local SHA256 match;2622 bytes'
$mf6 = [IO.File]::ReadAllText('evidence/v12-e2e-20261024-g6/D1-closure-20261028/prior/final-installed-probe-receipt.json') | ConvertFrom-Json
Add-EvidenceCheck 'MF6 authoritative FAIL retained' ($mf6.p95IncrementalMs -gt 20 -and [Math]::Abs($mf6.p95IncrementalMs-30.1605) -lt 0.000001 -and $mf6.samplesPerArm -eq 200) 'Historical raw receipt, not new measurement'
$doctor = [IO.File]::ReadAllText((Join-Path $root 'receipts/doctor-summary.json')) | ConvertFrom-Json
Add-EvidenceCheck 'readiness blocked, not submitted' (!$doctor.ready -and $doctor.reason -eq 'CDP_UNREACHABLE' -and !$doctor.newSubmission -and !$doctor.remoteCurrentPacketStaged) 'Latest retained doctor result'
$verification = [ordered]@{utc=[DateTime]::UtcNow.ToString('o');scope='EVIDENCE_INTEGRITY_ONLY';checks=$checks.Count;passed=@($checks | Where-Object {$_.pass}).Count;failed=@($checks | Where-Object {!$_.pass}).Count;sourceMismatches=$drift.Count;results=@($checks)}
Save-EvidenceJSON 'verification.json' $verification
if ($verification.failed) { throw "Evidence verification failed: $($verification.failed) checks" }
$terminal = [ordered]@{utc=[DateTime]::UtcNow.ToString('o');status='BRIDGE_PACKET_PREPARED_LOCALLY_M365_READINESS_BLOCKED';d1='AMEND';release='BLOCKED';mf6=[ordered]@{authoritativeMs=30.1605;thresholdMs=20;status='FAIL';newMeasurement=$false;protocol='NOT_REGISTERED'};sourceManifestSHA256=(Get-EvidenceSHA256 (Join-Path $root 'stable-source-manifest.json'));packetManifestSHA256=(Get-EvidenceSHA256 (Join-Path $root 'packet-manifest.json'));newSubmission=$false;remoteStaged=$false;currentSourceReviewRecovered=$false;historicalReviewTurn='183b8083-m365-worker-20261028-012828-16970c16';freshDoctor='ready:false CDP_UNREACHABLE';nextOwner='FJP maintainer readiness, then exclusive bridge conditional single review';handoff='HANDOFF.md';verification='verification.json'}
Save-EvidenceJSON 'terminal-receipt.json' $terminal
$inventory = @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object Name -ne 'checkpoint-files.json' | Sort-Object FullName | ForEach-Object {[ordered]@{path=[IO.Path]::GetRelativePath($root,$_.FullName).Replace('\','/');bytes=$_.Length;sha256=(Get-EvidenceSHA256 $_.FullName)}})
Save-EvidenceJSON 'checkpoint-files.json' $inventory
[pscustomobject]@{checks=$verification.checks;passed=$verification.passed;failed=$verification.failed;sourceMismatches=$verification.sourceMismatches;checkpointFiles=$inventory.Count;checkpointFilesSHA256=(Get-EvidenceSHA256 (Join-Path $root 'checkpoint-files.json'));handoffSHA256=(Get-EvidenceSHA256 (Join-Path $root 'HANDOFF.md'))} | ConvertTo-Json
