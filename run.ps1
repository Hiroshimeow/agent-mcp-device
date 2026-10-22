$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Read-Default([string]$Prompt, [string]$Default) {
    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}

function Resolve-LanIPv4 {
    $candidate = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254*' -and
            (
                $_.IPAddress -match '^10\.' -or
                $_.IPAddress -match '^192\.168\.' -or
                $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.'
            )
        } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($candidate) { return $candidate }
    return $env:COMPUTERNAME
}

function Invoke-Mcp([string[]]$Arguments, [switch]$Capture) {
    $node = Join-Path $PSScriptRoot 'runtime\node.exe'
    $entry = Join-Path $PSScriptRoot 'dist\mcp-device.js'
    if (-not (Test-Path -LiteralPath $node)) { throw "Bundled runtime is missing: $node" }
    if (-not (Test-Path -LiteralPath $entry)) { throw "Built MCP Device entry is missing: $entry" }
    if ($Capture) {
        $output = & $node $entry @Arguments 2>&1
        if ($LASTEXITCODE -ne 0) { throw ($output -join [Environment]::NewLine) }
        return ($output -join [Environment]::NewLine)
    }
    & $node $entry @Arguments
    if ($LASTEXITCODE -ne 0) { throw "mcp-device command failed with exit code $LASTEXITCODE" }
}

Write-Host ''
Write-Host '============================================================'
Write-Host ' MCP Device 1.0.12 - Local/LAN Server'
Write-Host ' no SSO | no cloud tunnel | no external MCP | no registry'
Write-Host '============================================================'
Write-Host ''

if ($env:MCP_LAN_ADMIN_PASS) {
    $adminPassword = $env:MCP_LAN_ADMIN_PASS
} else {
    $secure = Read-Host 'Admin_pass' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}
if ([string]::IsNullOrWhiteSpace($adminPassword)) { throw 'Admin password cannot be empty.' }

if ($env:MCP_LAN_ADMIN_MAIL) {
    $adminMail = $env:MCP_LAN_ADMIN_MAIL.Trim()
} else {
    do { $adminMail = (Read-Host 'Mail').Trim() } until ($adminMail -match '^[^@\s]+@[^@\s]+\.[^@\s]+$')
}
if ($adminMail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Invalid admin email.' }

$detectedIp = Resolve-LanIPv4
$publicHost = if ($env:MCP_LAN_HOST) { $env:MCP_LAN_HOST.Trim() } else { Read-Default 'Host/IP' $detectedIp }
$portText = if ($env:MCP_LAN_PORT) { $env:MCP_LAN_PORT.Trim() } else { Read-Default 'Port' '8101' }
[int]$port = 0
if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
    throw "Invalid port: $portText"
}

$allowHttp = if ($env:MCP_LAN_ALLOW_HTTP) { $env:MCP_LAN_ALLOW_HTTP.Trim() } else { Read-Default '--allow-http-lan' 'Y' }
if ($allowHttp -notmatch '^(?i:y|yes)$') {
    throw 'This ZIP is intentionally a trusted-LAN HTTP profile. HTTPS/public deployment is not configured by run.bat.'
}

$defaultSkillRoot = Join-Path $env:USERPROFILE '.mcp-device\skills'
$skillRoot = if ($env:MCP_LAN_SKILL_ROOT) { $env:MCP_LAN_SKILL_ROOT.Trim() } else { Read-Default '--skill-root' $defaultSkillRoot }
$skillRoot = [Environment]::ExpandEnvironmentVariables($skillRoot)
New-Item -ItemType Directory -Force -Path $skillRoot | Out-Null

$runtimeRoot = if ($env:MCP_LAN_RUNTIME_ROOT) { [Environment]::ExpandEnvironmentVariables($env:MCP_LAN_RUNTIME_ROOT) } else { Join-Path $env:USERPROFILE '.mcp-device\server' }
$configRoot = Join-Path $runtimeRoot 'lan-local-config'
New-Item -ItemType Directory -Force -Path $configRoot | Out-Null

$tomlPath = Join-Path $configRoot 'mcp-servers.toml'
$jsonPath = Join-Path $configRoot 'server.json'

@'
[server]
name = "mcp-device-lan"
title = "MCP Device LAN"
description = "Private local/LAN MCP Device server."
instructions = "Use account-owned Device tools and the shared server Skill catalog."

[surface]
mode = "agent"

[openai_tunnel]
enabled = false

[external_mcp]
enabled = false
default_enabled = false
catalog_cache = "none"
exposure_mode = "brokered"
'@ | Set-Content -LiteralPath $tomlPath -Encoding UTF8

@{
    configPath = 'mcp-servers.toml'
    env = @{
        MCP_EXTERNAL_MCP_ENABLED = 'false'
        MCP_DEVICE_RELEASE_LOOKUP = 'false'
        MCP_DEVICE_LATEST_VERSION = '1.0.12'
    }
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$busy = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
if ($busy) { throw "Port $port is already in use. Run again and choose another port." }

Write-Host ''
Write-Host '[1/4] Preparing local account database...'
$listJson = Invoke-Mcp -Arguments @('admin','--runtime-dir',$runtimeRoot,'account','list') -Capture
$list = $listJson | ConvertFrom-Json
$existing = @($list.accounts | Where-Object { $_.email -eq $adminMail })
if ($existing.Count -eq 0) {
    $env:HCU_ADMIN_PASSWORD = $adminPassword
    try {
        $null = Invoke-Mcp -Arguments @('admin','--runtime-dir',$runtimeRoot,'account','create-admin',$adminMail) -Capture
    } finally {
        Remove-Item Env:HCU_ADMIN_PASSWORD -ErrorAction SilentlyContinue
        $adminPassword = $null
    }
    Write-Host "  Admin created: $adminMail"
} elseif ($existing[0].role -eq 'admin') {
    $adminPassword = $null
    Write-Host "  Admin already exists: $adminMail"
    Write-Host '  Existing password was not changed.'
} else {
    throw "Account $adminMail already exists but is not an admin."
}

Write-Host '[2/4] Creating one-use invite code...'
$inviteJson = Invoke-Mcp -Arguments @('admin','--runtime-dir',$runtimeRoot,'invite','create','1') -Capture
$invite = $inviteJson | ConvertFrom-Json
$inviteCode = [string]$invite.codes[0]

Write-Host '[3/4] Restricting Windows Firewall to Private/LocalSubnet...'
$ruleName = "MCPDevice-LAN-$port"
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if ($env:MCP_LAN_SKIP_FIREWALL -eq '1') {
    Write-Host '  Firewall change skipped by test override.'
} elseif ($admin) {
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -Profile Private -RemoteAddress LocalSubnet | Out-Null
    Write-Host "  Firewall rule ready: $ruleName"
} else {
    Write-Warning 'Not running as Administrator; Windows Firewall rule was not changed.'
    Write-Warning "If another LAN machine cannot connect, allow TCP $port for Private/LocalSubnet only."
}

$baseUrl = "http://$($publicHost):$port"
Write-Host '[4/4] Starting MCP Device server...'
Write-Host ''
Write-Host '============================================================'
Write-Host ' READY'
Write-Host '============================================================'
Write-Host " MCP URL     : $baseUrl/mcp"
Write-Host " Dashboard   : $baseUrl/dashboard"
Write-Host " Login       : $baseUrl/login"
Write-Host " Signup      : $baseUrl/signup"
Write-Host " Invite code : $inviteCode"
Write-Host " Shared Skill: $skillRoot"
Write-Host " Admin       : $adminMail"
Write-Host ''
Write-Host ' ADD MEMBER'
Write-Host " 1. Open: $baseUrl/signup"
Write-Host " 2. Enter member email/password + invite: $inviteCode"
Write-Host " 3. In the member MCP client add: $baseUrl/mcp"
Write-Host ' 4. Login with that member account.'
Write-Host ''
Write-Host ' LOCAL DEVICE A1'
Write-Host ' The server includes Local Device A1.'
Write-Host ' On first start, open the device_pairing_required URL printed below,'
Write-Host ' login as the admin account, and approve A1.'
Write-Host ''
Write-Host ' LAN/local-only profile: external MCP, tunnel and package release'
Write-Host ' lookup are disabled. Press Ctrl+C to stop the server.'
Write-Host '============================================================'
Write-Host ''

$node = Join-Path $PSScriptRoot 'runtime\node.exe'
$entry = Join-Path $PSScriptRoot 'dist\mcp-device.js'
& $node $entry server --runtime-dir $runtimeRoot --config $jsonPath --host '0.0.0.0' --port $port --public-url $baseUrl --allow-http-lan --skill-root $skillRoot
exit $LASTEXITCODE
