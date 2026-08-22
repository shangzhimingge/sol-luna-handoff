[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$skillDirectory = Split-Path -Parent $PSScriptRoot
$installerPath = Join-Path $skillDirectory 'scripts\install-agents.ps1'
$assetsDirectory = Join-Path $skillDirectory 'assets'
$agentFiles = @('sol-planner.toml', 'luna-executor.toml')
$startMarker = '<!-- BEGIN SOL-LUNA-HANDOFF MANAGED BLOCK -->'
$endMarker = '<!-- END SOL-LUNA-HANDOFF MANAGED BLOCK -->'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool]$Condition,

        [Parameter(Mandatory)]
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function New-TemporaryCodexHome {
    $path = Join-Path ([System.IO.Path]::GetTempPath()) ("sol-luna-handoff-test-" + [guid]::NewGuid().ToString('N'))
    [System.IO.Directory]::CreateDirectory($path) | Out-Null
    return $path
}

function Invoke-TestInstaller {
    param(
        [Parameter(Mandatory)]
        [string]$CodexHome
    )

    $hadCodexHome = Test-Path Env:CODEX_HOME
    $previousCodexHome = $env:CODEX_HOME
    try {
        $env:CODEX_HOME = $CodexHome
        & $installerPath | Out-Null
    } finally {
        if ($hadCodexHome) {
            $env:CODEX_HOME = $previousCodexHome
        } else {
            Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
        }
    }
}

function Get-FileState {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (-not [System.IO.File]::Exists($Path)) {
        return 'MISSING'
    }

    $item = Get-Item -LiteralPath $Path
    return "FILE|$($item.Length)|$($item.LastWriteTimeUtc.Ticks)|$((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash)"
}

function Get-DirectoryState {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (-not [System.IO.Directory]::Exists($Path)) {
        return 'MISSING'
    }

    $rows = Get-ChildItem -LiteralPath $Path -Recurse -Force -File |
        Sort-Object FullName |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($Path.Length).TrimStart('\')
            "$relativePath|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)|$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)"
        }
    return "DIRECTORY`n$($rows -join "`n")"
}

function Test-DifferingAgentCollision {
    $codexHome = New-TemporaryCodexHome
    try {
        $agentsDirectory = Join-Path $codexHome 'agents'
        [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
        $collisionPath = Join-Path $agentsDirectory 'sol-planner.toml'
        [System.IO.File]::WriteAllText($collisionPath, 'existing custom definition', $utf8NoBom)
        $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
        [System.IO.File]::WriteAllText($globalAgentsPath, "# Existing global rules`n", $utf8NoBom)

        $agentsBefore = Get-DirectoryState $agentsDirectory
        $globalBefore = Get-FileState $globalAgentsPath
        $caughtMessage = $null
        try {
            Invoke-TestInstaller $codexHome
        } catch {
            $caughtMessage = $_.Exception.Message
        }

        Assert-True ($null -ne $caughtMessage) 'a differing agent must abort installation'
        Assert-True ($caughtMessage.Contains($collisionPath)) 'the collision error must name the destination'
        Assert-True ((Get-DirectoryState $agentsDirectory) -ceq $agentsBefore) 'collision abort must leave the agents directory unchanged'
        Assert-True ((Get-FileState $globalAgentsPath) -ceq $globalBefore) 'collision abort must leave AGENTS.md unchanged'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentsDirectory 'luna-executor.toml'))) 'collision abort must not create the other agent'
        Write-Output 'PASS differing-agent collision aborts without mutation'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-FreshInstall {
    $codexHome = New-TemporaryCodexHome
    try {
        Invoke-TestInstaller $codexHome
        $agentsDirectory = Join-Path $codexHome 'agents'
        foreach ($fileName in $agentFiles) {
            $installedPath = Join-Path $agentsDirectory $fileName
            $assetPath = Join-Path $assetsDirectory $fileName
            Assert-True (Test-Path -LiteralPath $installedPath) "fresh install must create $fileName"
            Assert-True (
                (Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash -ceq
                (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash
            ) "fresh install must copy $fileName exactly"
        }

        $globalContent = [System.IO.File]::ReadAllText((Join-Path $codexHome 'AGENTS.md'))
        Assert-True ($globalContent.Contains($startMarker)) 'fresh install must add the managed start marker'
        Assert-True ($globalContent.Contains($endMarker)) 'fresh install must add the managed end marker'
        Write-Output 'PASS fresh install copies agents and global block'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-MalformedGlobalMarkers {
    $codexHome = New-TemporaryCodexHome
    try {
        $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
        [System.IO.File]::WriteAllText($globalAgentsPath, "$startMarker`nmissing end marker`n", $utf8NoBom)
        $globalBefore = Get-FileState $globalAgentsPath
        $caughtMessage = $null
        try {
            Invoke-TestInstaller $codexHome
        } catch {
            $caughtMessage = $_.Exception.Message
        }

        Assert-True ($null -ne $caughtMessage) 'malformed global markers must abort installation'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $codexHome 'agents'))) 'marker validation must occur before agent-directory creation'
        Assert-True ((Get-FileState $globalAgentsPath) -ceq $globalBefore) 'marker failure must leave AGENTS.md unchanged'
        Write-Output 'PASS malformed global markers abort before mutation'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-IdenticalFilesAreIdempotent {
    $codexHome = New-TemporaryCodexHome
    try {
        $agentsDirectory = Join-Path $codexHome 'agents'
        [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
        foreach ($fileName in $agentFiles) {
            [System.IO.File]::WriteAllBytes(
                (Join-Path $agentsDirectory $fileName),
                [System.IO.File]::ReadAllBytes((Join-Path $assetsDirectory $fileName))
            )
        }

        $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
        [System.IO.File]::WriteAllText($globalAgentsPath, "# Existing global rules`n", $utf8NoBom)
        $agentsBeforeFirstRun = Get-DirectoryState $agentsDirectory

        Invoke-TestInstaller $codexHome
        Assert-True ((Get-DirectoryState $agentsDirectory) -ceq $agentsBeforeFirstRun) 'identical existing agents must not be rewritten'

        $agentsAfterFirstRun = Get-DirectoryState $agentsDirectory
        $globalAfterFirstRun = Get-FileState $globalAgentsPath
        $globalContent = [System.IO.File]::ReadAllText($globalAgentsPath)
        Assert-True (([regex]::Matches($globalContent, [regex]::Escape($startMarker))).Count -eq 1) 'the managed start marker must occur once'
        Assert-True (([regex]::Matches($globalContent, [regex]::Escape($endMarker))).Count -eq 1) 'the managed end marker must occur once'

        Start-Sleep -Milliseconds 1100
        Invoke-TestInstaller $codexHome
        Assert-True ((Get-DirectoryState $agentsDirectory) -ceq $agentsAfterFirstRun) 'a repeated install must not rewrite identical agents'
        Assert-True ((Get-FileState $globalAgentsPath) -ceq $globalAfterFirstRun) 'a repeated install must not rewrite identical AGENTS.md content'
        Write-Output 'PASS identical files and managed block are idempotent'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Test-DifferingAgentCollision
Test-FreshInstall
Test-MalformedGlobalMarkers
Test-IdenticalFilesAreIdempotent
Write-Output 'ALL TESTS PASSED'
