# Evidence-only snapshot builder. Reads source/evidence; writes ONLY this new checkpoint directory.
$ErrorActionPreference = 'Stop'
$repo = 'E:/git-project/agent-mcp-device-v12'
$root = Join-Path $repo 'evidence/v12-e2e-20261024-g6/D1-bridge-checkpoint-20261029'
$base = Join-Path $repo 'evidence/v12-e2e-20261024-g6'
$utf8 = [Text.UTF8Encoding]::new($false)
function Save-Text($path, $text) { [IO.File]::WriteAllText($path, $text, $utf8) }
function Hash($path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Info($path) { [ordered]@{path=[IO.Path]::GetRelativePath($root,$path).Replace('\','/');bytes=(Get-Item -LiteralPath $path).Length;sha256=(Hash $path)} }
foreach ($dir in @('recovered','receipts','packet')) { [IO.Directory]::CreateDirectory((Join-Path $root $dir)) | Out-Null }
$manifestPath = Join-Path $base 'D1-remaining-fixes-20261029/stable-source-manifest.json'
$manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
$manifestHash = Hash $manifestPath
if ($manifestHash -ne 'b3d88dd794dec9b3e8282f2e39d0759e6f5a35ee6f678e7ce43a64269632be98') { throw 'Stable manifest identity changed' }
$drift = @($manifest | Where-Object { (Hash (Join-Path $repo $_.path)) -ne $_.sha256 })
if ($drift.Count) { throw "Source drift: $($drift.path -join ', ')" }
[IO.File]::Copy($manifestPath, (Join-Path $root 'stable-source-manifest.json'), $false)
# Preserve exact historical answer and existing byte-transfer receipts, not decoded/re-encoded text.
$prior = 'C:/Users/admin/AppData/Local/Temp/v12-d1-bridge-del_mvtmebut_fjan'
foreach ($name in @('response.remote-exact.md','transfer-manifest.json','transfer-receipt.json','bridge-tool-evidence.json','BRIDGE-HANDOFF.md')) {
    $destName = if ($name -eq 'response.remote-exact.md') { 'response.md' } else { $name }
    [IO.File]::Copy((Join-Path $prior $name), (Join-Path $root "recovered/$destName"), $false)
}
if ((Hash (Join-Path $root 'recovered/response.md')) -ne 'e901a780bb44e8f345c81a78edaee3fe37af712bb38178d9b971defceb2eafd8') { throw 'Historical response hash mismatch' }
# Recover bounded remote receipts from this actual session, retaining original result content and message IDs.
$receiptIndex = [Collections.Generic.List[object]]::new()
$stateRecovered = $false
foreach ($line in [IO.File]::ReadLines($env:PI_SESSION_FILE)) {
    try { $o = $line | ConvertFrom-Json } catch { continue }
    if ($o.message.role -ne 'toolResult') { continue }
    foreach ($c in $o.message.content) {
        if ($c.type -ne 'text' -or $c.text -match '^structuredContent:') { continue }
        try { $j = $c.text | ConvertFrom-Json } catch { continue }
        $isShellReceipt = $null -ne $j.workingDirectoryResolved -and $j.workingDirectoryResolved -match 'M365-Copilot2DOM'
        $isDoctorReceipt = $c.text -match 'CDP_UNREACHABLE' -and $c.text -match 'remote-ea947b2f-25c8-42a0-978b-19304e57f1b1'
        if (($isShellReceipt -and $j.stdout -match 'STATE_BASE64:|latestD1|otherPotentiallyActive|d1Turns|potentiallyActive|"d1"') -or $isDoctorReceipt) {
            $p = Join-Path $root "receipts/tool-$($o.id).json"
            if (!(Test-Path -LiteralPath $p)) { Save-Text $p $c.text; $receiptIndex.Add([ordered]@{messageId=$o.id;sessionTimestamp=$o.timestamp;file=(Info $p)}) }
        }
        if (!$stateRecovered -and $j.stdout -match 'STATE_BASE64:([A-Za-z0-9+/=]+)') {
            $statePath = Join-Path $root 'recovered/state.json'
            [IO.File]::WriteAllBytes($statePath,[Convert]::FromBase64String($Matches[1]))
            if ((Hash $statePath) -ne '4999e2fd715b25d1e2aabfbf48e83a531abc91830323f8ef60076af1ea33c999') { throw 'Historical state hash mismatch' }
            $remoteHashes = @($j.stdout -split '\r?\n' | Where-Object { $_.StartsWith('{"name":') } | ForEach-Object { $_ | ConvertFrom-Json })
            Save-Text (Join-Path $root 'recovered/remote-file-hashes.json') ($remoteHashes | ConvertTo-Json -Depth 6)
            $stateRecovered = $true
        }
    }
}
if (!$stateRecovered) { throw 'Exact remote state was not recovered' }
if (!($receiptIndex | Where-Object { [IO.File]::ReadAllText((Join-Path $root $_.file.path)) -match 'remote-ea947b2f' })) { throw 'Latest doctor receipt missing' }
Save-Text (Join-Path $root 'receipts/index.json') ($receiptIndex | ConvertTo-Json -Depth 8)
$state = [IO.File]::ReadAllText((Join-Path $root 'recovered/state.json')) | ConvertFrom-Json
if ($state.status -ne 'COMPLETED' -or !$state.send_confirmed -or $state.job_id -ne '183b8083-m365-worker-20261028-012828-16970c16') { throw 'Historical turn binding invalid' }
Save-Text (Join-Path $root 'recovered/identity.json') ([ordered]@{turnId=$state.job_id;status=$state.status;conversationId=$state.conversation_id;model=$state.verified_model_label;promptSHA256=$state.prompt_hash;oldAttachment=$state.attachments;state=(Info (Join-Path $root 'recovered/state.json'));response=(Info (Join-Path $root 'recovered/response.md'));historicalOnly=$true;currentSourceReview=$false} | ConvertTo-Json -Depth 8)
# Non-text/unneeded sample bytes and TLS fixture material are intentionally not uploaded.
$excluded = @($manifest | Where-Object { $_.path -match '\.(pdf|pem)$' -or $_.path -eq 'test/large_test_file.txt' })
$included = @($manifest | Where-Object { $_.path -notin $excluded.path })
$excludedIndex = @($excluded | ForEach-Object { [ordered]@{path=$_.path;sha256=$_.sha256;bytes=(Get-Item -LiteralPath (Join-Path $repo $_.path)).Length;reason='Non-review sample/PDF or certificate/key fixture; hash-only, NOT included content and must not be claimed inspected.'} })
Save-Text (Join-Path $root 'packet/omitted-source-content.json') ($excludedIndex | ConvertTo-Json -Depth 6)
$parts = [Collections.Generic.List[object]]::new()
$builder = [Text.StringBuilder]::new()
$part = 0
$partPaths = [Collections.Generic.List[string]]::new()
function Flush-SourcePart {
    if (!$script:builder.Length) { return }
    $script:part++
    $path = Join-Path $root ('packet/source-{0:D2}.txt' -f $script:part)
    Save-Text $path ("D1 CURRENT SOURCE — TEXT CONTENT ONLY; manifest SHA256 $manifestHash; see omitted-source-content.json for explicit hash-only exclusions.`n`n" + $script:builder.ToString())
    $script:parts.Add([ordered]@{file=(Info $path);sourcePaths=@($script:partPaths)})
    [void]$script:builder.Clear(); $script:partPaths.Clear()
}
foreach ($entry in $included) {
    $path = Join-Path $repo $entry.path
    $bytes = [IO.File]::ReadAllBytes($path)
    $text = [Text.UTF8Encoding]::new($false,$true).GetString($bytes)
    if ($text.Contains([char]0)) { throw "Unexpected binary in $($entry.path)" }
    $block = "`n===== BEGIN SOURCE $($entry.path) | original-bytes=$($bytes.Length) | sha256=$($entry.sha256) =====`n$text`n===== END SOURCE $($entry.path) =====`n"
    if ($builder.Length -gt 0 -and $utf8.GetByteCount($builder.ToString()+$block) -gt 700000) { Flush-SourcePart }
    [void]$builder.Append($block); $partPaths.Add($entry.path)
}
Flush-SourcePart
# Include full raw milestone content, avoiding huge process/environment dumps and unrelated files.
$evidencePaths = [Collections.Generic.List[string]]::new()
foreach ($milestone in @('D1-review-fixes-20261028','D1-lifecycle-fixes-20261028','D1-remaining-fixes-20261029')) {
    $dir = Join-Path $base $milestone
    foreach ($name in @('HANDOFF.md','REVIEW-DISPOSITION.md','receipt.json','final-summary.json','final-integrity-check.json','identity-inheritance.json','changed-files.json','evidence-manifest.json','verification-commands.json','review-final.md','review-initial.md')) {
        $p = Join-Path $dir $name
        if (Test-Path -LiteralPath $p) { $evidencePaths.Add($p) }
    }
    foreach ($p in Get-ChildItem -LiteralPath (Join-Path $dir 'logs') -File | Where-Object { $_.Name -notmatch '^git-|^process-|^wip-' }) { $evidencePaths.Add($p.FullName) }
}
foreach ($rel in @('D1-closure-20261028/receipt.json','D1-closure-20261028/prior/final-installed-probe-receipt.json','D1-closure-20261028/prior/installed-probe-receipt.json','D1-closure-20261028/prior/green-installed-probe.log','D1-closure-20261028/resume/lock-cancel-final.log','D1-closure-20261028/resume/defender-live-precondition.json','D1-closure-20261028/resume/diagnostic.log')) { $evidencePaths.Add((Join-Path $base $rel)) }
foreach ($p in @('AGENTS.md','docs/STATUS.md')) { $evidencePaths.Add((Join-Path $repo $p)) }
$evidencePaths.Add('E:/test/mcp-device-v12-e2e-20261024-g6/HANDOFF_20261027_TO_NEXT_SESSION.md')
foreach ($name in @('CONSOLIDATED-DISPOSITIONS.md','MF6-PROTOCOL-QUESTIONS.md','review-request.md','recovered/response.md','recovered/state.json','recovered/identity.json')) { $evidencePaths.Add((Join-Path $root $name)) }
$eb = [Text.StringBuilder]::new("D1 CONSOLIDATED EVIDENCE CONTENT — historical executions, NOT fresh tests or current acceptance.`n")
$evidenceIndex = [Collections.Generic.List[object]]::new()
foreach ($path in $evidencePaths) {
    if (!(Test-Path -LiteralPath $path)) { throw "Missing requested evidence $path" }
    $sha = Hash $path
    $length = (Get-Item -LiteralPath $path).Length
    [void]$eb.Append("`n===== BEGIN EVIDENCE $path | original-bytes=$length | sha256=$sha =====`n")
    [void]$eb.Append([IO.File]::ReadAllText($path))
    [void]$eb.Append("`n===== END EVIDENCE $path =====`n")
    $evidenceIndex.Add([ordered]@{path=$path;bytes=$length;sha256=$sha;contentIncluded=$true})
}
Save-Text (Join-Path $root 'packet/evidence-content.txt') $eb.ToString()
$inventory = [ordered]@{createdAt=[DateTime]::UtcNow.ToString('o');sourceManifestSHA256=$manifestHash;sourceManifestCount=$manifest.Count;includedTextCount=$included.Count;omittedHashOnlyCount=$excluded.Count;sourceParts=@($parts);evidenceContent=(Info (Join-Path $root 'packet/evidence-content.txt'));evidenceFiles=@($evidenceIndex);omissions=(Info (Join-Path $root 'packet/omitted-source-content.json'));prompt=(Info (Join-Path $root 'review-request.md'));remoteStaged=$false;submitted=$false;currentReviewRecovered=$false;sourceHashMismatches=$drift.Count}
Save-Text (Join-Path $root 'packet-manifest.json') ($inventory | ConvertTo-Json -Depth 12)
$status = @(git -C $repo status --short --untracked-files=all)
Save-Text (Join-Path $root 'receipts/repository-state.json') ([ordered]@{utc=[DateTime]::UtcNow.ToString('o');topLevel=(& git -C $repo rev-parse --show-toplevel);head=(& git -C $repo rev-parse HEAD);branch=(& git -C $repo branch --show-current);trackedDirtyCount=@($status|Where-Object {$_ -notmatch '^\?\?'}).Count;untrackedCount=@($status|Where-Object {$_ -match '^\?\?'}).Count;ignoredCount=@(git -C $repo ls-files --others --ignored --exclude-standard).Count;processId=$PID;cwd=(Get-Location).Path;sourceManifestSHA256=$manifestHash;sourceHashMismatches=$drift.Count;sourceFiles=$manifest.Count;remoteStaged=$false;newSubmission=$false;measurements=$false;testsRun=$false;builds=$false} | ConvertTo-Json -Depth 5)
[pscustomobject]$inventory | Select-Object sourceManifestCount,includedTextCount,omittedHashOnlyCount,sourceHashMismatches,remoteStaged,submitted,currentReviewRecovered | ConvertTo-Json
$parts | ForEach-Object { $_.file } | ConvertTo-Json
Info (Join-Path $root 'packet/evidence-content.txt') | ConvertTo-Json
