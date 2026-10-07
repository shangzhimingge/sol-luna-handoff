[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$skillDirectory = Join-Path $repositoryRoot 'skill\sol-luna-handoff'
$installerPath = Join-Path $skillDirectory 'scripts\install-agents.ps1'
$assetsDirectory = Join-Path $skillDirectory 'assets'
$agentFiles = @(
    'sol-planner.toml',
    'sol-compact-planner.toml',
    'luna-scout.toml',
    'luna-executor.toml',
    'luna-fast-executor.toml'
)
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
    $temporaryRoot = if ($env:TEST_TEMP_ROOT) { $env:TEST_TEMP_ROOT } else { [System.IO.Path]::GetTempPath() }
    $path = Join-Path $temporaryRoot ("sol-luna-handoff-test-" + [guid]::NewGuid().ToString('N'))
    [System.IO.Directory]::CreateDirectory($path) | Out-Null
    return $path
}

function Invoke-TestInstaller {
    param(
        [Parameter(Mandatory)]
        [string]$CodexHome,

        [switch]$WhatIf,

        [string]$Fault = ''
    )

    $hadCodexHome = Test-Path Env:CODEX_HOME
    $previousCodexHome = $env:CODEX_HOME
    $hadFault = Test-Path Env:SOL_LUNA_HANDOFF_TEST_FAULT
    $previousFault = $env:SOL_LUNA_HANDOFF_TEST_FAULT
    try {
        $env:CODEX_HOME = $CodexHome
        if ($Fault) {
            $env:SOL_LUNA_HANDOFF_TEST_FAULT = $Fault
        } else {
            Remove-Item Env:SOL_LUNA_HANDOFF_TEST_FAULT -ErrorAction SilentlyContinue
        }
        & $installerPath -WhatIf:$WhatIf | Out-Null
    } finally {
        if ($hadCodexHome) {
            $env:CODEX_HOME = $previousCodexHome
        } else {
            Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue
        }
        if ($hadFault) {
            $env:SOL_LUNA_HANDOFF_TEST_FAULT = $previousFault
        } else {
            Remove-Item Env:SOL_LUNA_HANDOFF_TEST_FAULT -ErrorAction SilentlyContinue
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

function Test-DifferingAgentCollisions {
    foreach ($fileName in $agentFiles) {
        $codexHome = New-TemporaryCodexHome
        try {
            $agentsDirectory = Join-Path $codexHome 'agents'
            [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
            $collisionPath = Join-Path $agentsDirectory $fileName
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

            Assert-True ($null -ne $caughtMessage) "a differing $fileName must abort installation"
            Assert-True ($caughtMessage.Contains($collisionPath)) 'the collision error must name the destination'
            Assert-True ((Get-DirectoryState $agentsDirectory) -ceq $agentsBefore) 'collision abort must leave the agents directory unchanged'
            Assert-True ((Get-FileState $globalAgentsPath) -ceq $globalBefore) 'collision abort must leave AGENTS.md unchanged'
            foreach ($otherFileName in $agentFiles | Where-Object { $_ -cne $fileName }) {
                Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentsDirectory $otherFileName))) 'collision preflight must not install another agent'
            }
            Write-Output "PASS differing $fileName collision aborts without mutation"
        } finally {
            Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
        }
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
        $profile = [System.IO.File]::ReadAllText((Join-Path $codexHome 'sol-luna-handoff.json')) | ConvertFrom-Json
        Assert-True ($profile.schemaVersion -eq 2) 'fresh install must write workflow schema 2'
        Assert-True ($profile.workflow -ceq 'sol-luna') 'fresh install must write the only supported workflow'
        Write-Output 'PASS fresh install copies agents and global block'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-LegacyConfigMigration {
    $codexHome = New-TemporaryCodexHome
    try {
        $profilePath = Join-Path $codexHome 'sol-luna-handoff.json'
        [System.IO.File]::WriteAllText(
            $profilePath,
            "{`n  `"schemaVersion`": 1,`n  `"executionProfile`": `"adaptive`"`n}`n",
            $utf8NoBom
        )
        Invoke-TestInstaller $codexHome
        $profile = [System.IO.File]::ReadAllText($profilePath) | ConvertFrom-Json
        Assert-True ($profile.schemaVersion -eq 2) 'legacy config must migrate to schema 2'
        Assert-True ($profile.workflow -ceq 'sol-luna') 'legacy config must migrate to Sol-Luna workflow'
        Write-Output 'PASS PowerShell installer migrates legacy configuration'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-ManagedTerraContent {
    return (@(
        'name = "terra_executor"',
        'description = "Implements Tier 2 Terra exceptions and the main body of Tier 3 work."',
        'model = "gpt-5.6-terra"',
        'model_reasoning_effort = "medium"',
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """',
        'Implement the supplied task brief or binding plan for a Tier 2 Terra exception or Tier 3 main body. A Luna handoff may also supply the original task brief or binding plan, Luna report, current diff, and check evidence. Preserve useful existing changes, continue from that evidence instead of restarting without cause, and remain the same executor for all remaining implementation and ordinary corrections.',
        '',
        'Exercise the judgment or non-local diagnosis required by the named Terra exception while preserving architecture, compatibility constraints, scope, and acceptance criteria. Run every required check, inspect the final diff, and self-review each acceptance criterion. Stop before further edits and report UPGRADE_NEEDED when scope or risk crosses the supplied tier; report PLAN_BLOCKED when a material architectural or requirement decision is missing. Return at most 300 output tokens with changed files, concise summary, commands and exit status, self-review, and remaining concerns or NONE. Store raw command output in task-local files. Do not spawn other agents or broaden scope.',
        '"""',
        ''
    ) -join "`n")
}

function Test-RetiredTerraRollback {
    foreach ($fault in @('after-legacy-agent-removal', 'after-config-write')) {
        $codexHome = New-TemporaryCodexHome
        try {
            $agentsDirectory = Join-Path $codexHome 'agents'
            [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
            [System.IO.File]::WriteAllText((Join-Path $agentsDirectory 'terra-executor.toml'), (Get-ManagedTerraContent), $utf8NoBom)
            [System.IO.File]::WriteAllText(
                (Join-Path $codexHome 'sol-luna-handoff.json'),
                "{`n  `"schemaVersion`": 1,`n  `"executionProfile`": `"adaptive`"`n}`n",
                $utf8NoBom
            )
            $before = Get-DirectoryState $codexHome
            $caught = $null
            try {
                Invoke-TestInstaller $codexHome -Fault $fault
            } catch {
                $caught = $_.Exception.Message
            }
            Assert-True ($null -ne $caught -and $caught.Contains($fault)) "$fault must be injected"
            Assert-True ((Get-DirectoryState $codexHome) -ceq $before) "$fault must restore exact content"
            Write-Output "PASS $fault restores config and retired agent"
        } finally {
            Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-ProfileDirectoryCollisionAbortsBeforeMutation {
    $codexHome = New-TemporaryCodexHome
    try {
        $profilePath = Join-Path $codexHome 'sol-luna-handoff.json'
        [System.IO.Directory]::CreateDirectory($profilePath) | Out-Null
        $before = Get-DirectoryState $codexHome
        $caughtMessage = $null
        try {
            Invoke-TestInstaller $codexHome
        } catch {
            $caughtMessage = $_.Exception.Message
        }

        Assert-True ($null -ne $caughtMessage) 'a profile directory collision must abort installation'
        Assert-True ($caughtMessage.Contains($profilePath)) 'the profile collision must name the path'
        Assert-True ((Get-DirectoryState $codexHome) -ceq $before) 'profile directory collision must leave every file unchanged'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $codexHome 'agents'))) 'profile collision preflight must not create agents'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $codexHome 'AGENTS.md'))) 'profile collision preflight must not create AGENTS.md'
        Write-Output 'PASS profile directory collision aborts before mutation'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-PostWriteFailureRestoresExactSnapshot {
    $codexHome = New-TemporaryCodexHome
    try {
        $globalPath = Join-Path $codexHome 'AGENTS.md'
        $profilePath = Join-Path $codexHome 'sol-luna-handoff.json'
        [System.IO.File]::WriteAllText($globalPath, "# Preserve exact global state`r`n", $utf8NoBom)
        [System.IO.File]::WriteAllText(
            $profilePath,
            "{`n  `"schemaVersion`": 1,`n  `"executionProfile`": `"adaptive`"`n}`n",
            $utf8NoBom
        )
        $before = Get-DirectoryState $codexHome
        $caughtMessage = $null
        try {
            Invoke-TestInstaller $codexHome -Fault 'after-config-write'
        } catch {
            $caughtMessage = $_.Exception.Message
        }

        Assert-True ($null -ne $caughtMessage) 'an injected post-write failure must abort installation'
        Assert-True ($caughtMessage.Contains('after-config-write')) 'the injected failure must identify its point'
        Assert-True ((Get-DirectoryState $codexHome) -ceq $before) 'rollback must restore exact file hashes and timestamps'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $codexHome 'agents'))) 'rollback must remove a newly created agents directory'
        Write-Output 'PASS injected post-write failure restores the exact snapshot'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-V100LunaExecutorContent {
    param(
        [ValidateSet('LF', 'CRLF')]
        [string]$NewlineStyle = 'LF'
    )

    $newline = if ($NewlineStyle -ceq 'CRLF') { "`r`n" } else { "`n" }
    return (@(
        'name = "luna_executor"',
        'description = "Implements an approved plan, runs its checks, and returns concise evidence."',
        'model = "gpt-5.6-luna"',
        'model_reasoning_effort = "medium"',
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """',
        'Execute the supplied plan as a binding contract. Make only in-scope changes, run every specified verification command, inspect the resulting diff, and report changed files, command outputs, and remaining concerns. If context is missing, return NEEDS_CONTEXT with exact missing facts. Do not redesign the task or broaden scope.',
        '"""'
    ) -join $newline) + $newline
}

function Test-V100Upgrade {
    foreach ($newlineStyle in @('LF', 'CRLF')) {
        $codexHome = New-TemporaryCodexHome
        try {
            $agentsDirectory = Join-Path $codexHome 'agents'
            [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
            [System.IO.File]::WriteAllBytes(
                (Join-Path $agentsDirectory 'sol-planner.toml'),
                [System.IO.File]::ReadAllBytes((Join-Path $assetsDirectory 'sol-planner.toml'))
            )
            [System.IO.File]::WriteAllBytes(
                (Join-Path $agentsDirectory 'luna-executor.toml'),
                $utf8NoBom.GetBytes((Get-V100LunaExecutorContent -NewlineStyle $newlineStyle))
            )

            $oldManagedBlock = @(
                $startMarker,
                '## Sol-Luna project workflow',
                '',
                'For every project artifact task, use the fixed Sol-Luna-Sol route.',
                $endMarker
            ) -join "`n"
            $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
            [System.IO.File]::WriteAllText($globalAgentsPath, "# Keep this rule`n`n$oldManagedBlock`n", $utf8NoBom)

            Invoke-TestInstaller $codexHome

            foreach ($fileName in $agentFiles) {
                Assert-True (
                    (Get-FileHash -LiteralPath (Join-Path $agentsDirectory $fileName) -Algorithm SHA256).Hash -ceq
                    (Get-FileHash -LiteralPath (Join-Path $assetsDirectory $fileName) -Algorithm SHA256).Hash
                ) "v1.0 $newlineStyle upgrade must install the canonical $fileName bytes"
            }
            $globalContent = [System.IO.File]::ReadAllText($globalAgentsPath)
            Assert-True ($globalContent.Contains('# Keep this rule')) 'v1.0 upgrade must preserve unrelated global guidance'
            Assert-True ($globalContent.Contains('Tier 1, Tier 2, or Tier 3 Sol-Luna route')) 'v1.0 upgrade must replace the managed rule'
            Write-Output "PASS v1.0 $newlineStyle built-in agent upgrades to canonical bytes"
        } finally {
            Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-V110CompactPlannerContent {
    param(
        [ValidateSet('LF', 'CRLF')]
        [string]$NewlineStyle = 'LF'
    )

    $newline = if ($NewlineStyle -ceq 'CRLF') { "`r`n" } else { "`n" }
    return (@(
        'name = "sol_compact_planner"',
        'description = "Produces a bounded plan for medium, low-risk project work."',
        'model = "gpt-5.6-sol"',
        'model_reasoning_effort = "medium"',
        'sandbox_mode = "read-only"',
        'developer_instructions = """',
        'Inspect only task-local context and return a plan capped at 500 output tokens. Include only scope and non-goals, ordered steps, affected files, verification commands, and testable acceptance criteria. If essential context is missing, return NEEDS_CONTEXT with the exact missing facts. Do not implement, broaden scope, or perform final verification.',
        '"""'
    ) -join $newline) + $newline
}

function Get-V110BundledAgentContent {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('sol-planner.toml', 'luna-executor.toml', 'luna-fast-executor.toml')]
        [string]$FileName,

        [ValidateSet('LF', 'CRLF')]
        [string]$NewlineStyle = 'LF'
    )

    $utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
    if ($FileName -ceq 'luna-executor.toml') {
        $content = @(
            'name = "luna_executor"',
            'description = "Implements an approved plan, runs its checks, and returns concise evidence."',
            'model = "gpt-5.6-luna"',
            'model_reasoning_effort = "medium"',
            'sandbox_mode = "workspace-write"',
            'developer_instructions = """',
            'Execute the supplied plan as a binding contract. Make only in-scope changes, run every specified verification command, inspect the resulting diff, and self-review against every acceptance criterion. Stop before further edits and report UPGRADE_NEEDED if discovered scope or risk exceeds the supplied tier. Return a report capped at 300 output tokens with changed files, concise summary, commands and exit status, self-review, and remaining concerns or NONE; raw command output may be stored in files and is excluded from the cap. If context is missing, return NEEDS_CONTEXT with exact missing facts. Do not redesign or broaden scope.',
            '"""',
            ''
        ) -join "`n"
    } else {
        $content = [System.IO.File]::ReadAllText((Join-Path $assetsDirectory $FileName), $utf8Strict)
        $content = $content.Replace('gpt-6.1-sol', 'gpt-5.6-sol').Replace('gpt-6-luna', 'gpt-5.6-luna')
    }
    $lfContent = $content.Replace("`r`n", "`n").Replace("`r", "`n")
    if ($NewlineStyle -ceq 'CRLF') {
        return $lfContent.Replace("`n", "`r`n")
    }
    return $lfContent
}

function Install-V110AgentFixtures {
    param(
        [Parameter(Mandatory)]
        [string]$AgentsDirectory,

        [ValidateSet('LF', 'CRLF')]
        [string]$NewlineStyle = 'LF'
    )

    foreach ($fileName in @('sol-planner.toml', 'luna-executor.toml', 'luna-fast-executor.toml')) {
        [System.IO.File]::WriteAllBytes(
            (Join-Path $AgentsDirectory $fileName),
            $utf8NoBom.GetBytes((Get-V110BundledAgentContent -FileName $fileName -NewlineStyle $NewlineStyle))
        )
    }
    [System.IO.File]::WriteAllBytes(
        (Join-Path $AgentsDirectory 'sol-compact-planner.toml'),
        $utf8NoBom.GetBytes((Get-V110CompactPlannerContent -NewlineStyle $NewlineStyle))
    )
}

function Test-V110Upgrade {
    $expectedLegacyHashes = @{
        'sol-planner.toml' = @{
            'LF' = '7B6FB8A14C22354125C08BC255F4203B7BF8EBF505209402FA8A7BBD91EBA431'
            'CRLF' = '140A285E3485546848294A9DE46AA96E7B021B24AA8A83BC8E546854D9B93B4F'
        }
        'sol-compact-planner.toml' = @{
            'LF' = 'E8E9F21443434F523AA71DF343965ACDE93AD8ECEC3293F90F8386E4A5046A36'
            'CRLF' = '2C7A9FE24E737DC1DD3D6E97CAC9745EB42CA0174587DEB083FC66C7C07DAA8A'
        }
        'luna-executor.toml' = @{
            'LF' = '91AA121E7248CA507FFB594D7768595E1E0C6267BD5435745DC2573DAB9957FA'
            'CRLF' = '89864C97A3DC252F684CA46BC405E414D4811465517F5D721AABC9C8AAE2669D'
        }
        'luna-fast-executor.toml' = @{
            'LF' = '5400B0F6F9EE8CAAD4678779A6FB89F99C59835669BF579DD0A70F1F05BF9393'
            'CRLF' = '099C58C9F0AF4B6B2A0F923782E0953BB798FB8AA48ED29EDF7E2550EAA3F5A6'
        }
    }

    foreach ($newlineStyle in @('LF', 'CRLF')) {
        $codexHome = New-TemporaryCodexHome
        try {
            $agentsDirectory = Join-Path $codexHome 'agents'
            [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
            Install-V110AgentFixtures -AgentsDirectory $agentsDirectory -NewlineStyle $newlineStyle
            foreach ($fileName in $expectedLegacyHashes.Keys) {
                Assert-True (
                    (Get-FileHash -LiteralPath (Join-Path $agentsDirectory $fileName) -Algorithm SHA256).Hash -ceq
                    $expectedLegacyHashes[$fileName][$newlineStyle]
                ) "v1.1 $newlineStyle $fileName fixture must match the approved legacy hash"
            }

            $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
            [System.IO.File]::WriteAllText($globalAgentsPath, "# Keep this v1.1 rule`n", $utf8NoBom)

            Invoke-TestInstaller $codexHome

            foreach ($fileName in $agentFiles) {
                Assert-True (
                    (Get-FileHash -LiteralPath (Join-Path $agentsDirectory $fileName) -Algorithm SHA256).Hash -ceq
                    (Get-FileHash -LiteralPath (Join-Path $assetsDirectory $fileName) -Algorithm SHA256).Hash
                ) "v1.1 $newlineStyle upgrade must install the canonical $fileName bytes"
            }
            $globalContent = [System.IO.File]::ReadAllText($globalAgentsPath)
            Assert-True ($globalContent.Contains('# Keep this v1.1 rule')) 'v1.1 upgrade must preserve unrelated global guidance'
            Write-Output "PASS v1.1 $newlineStyle built-in agents upgrade to canonical bytes"
        } finally {
            Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-V110UpgradeWithLaterUnknownCollisionIsAtomic {
    $codexHome = New-TemporaryCodexHome
    try {
        $agentsDirectory = Join-Path $codexHome 'agents'
        [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
        Install-V110AgentFixtures -AgentsDirectory $agentsDirectory -NewlineStyle 'LF'
        $unknownCollisionPath = Join-Path $agentsDirectory 'terra-executor.toml'
        [System.IO.File]::WriteAllText($unknownCollisionPath, 'unknown custom Terra definition', $utf8NoBom)
        $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
        [System.IO.File]::WriteAllText($globalAgentsPath, "# Keep this v1.1 rule`n", $utf8NoBom)

        $agentsBefore = Get-DirectoryState $agentsDirectory
        $globalBefore = Get-FileState $globalAgentsPath
        $caughtMessage = $null
        try {
            Invoke-TestInstaller $codexHome
        } catch {
            $caughtMessage = $_.Exception.Message
        }

        Assert-True ($null -ne $caughtMessage) 'a later unknown collision must abort a v1.1 migration'
        Assert-True ($caughtMessage.Contains($unknownCollisionPath)) 'the later collision must name the unknown destination'
        Assert-True ((Get-DirectoryState $agentsDirectory) -ceq $agentsBefore) 'known legacy files must remain byte-identical when a later collision aborts preflight'
        Assert-True ((Get-FileState $globalAgentsPath) -ceq $globalBefore) 'AGENTS.md must remain unchanged when a later collision aborts preflight'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentsDirectory 'luna-scout.toml'))) 'preflight abort must not create a missing new agent'
        Write-Output 'PASS v1.1 legacy migration plus later unknown collision aborts atomically'
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
        Assert-True ($globalContent.Contains('# Existing global rules')) 'install must preserve unrelated global guidance'
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

function Test-WhatIfDoesNotMutate {
    $codexHome = New-TemporaryCodexHome
    try {
        $globalAgentsPath = Join-Path $codexHome 'AGENTS.md'
        [System.IO.File]::WriteAllText($globalAgentsPath, "# Existing global rules`n", $utf8NoBom)
        $homeBefore = Get-DirectoryState $codexHome

        Invoke-TestInstaller -CodexHome $codexHome -WhatIf

        Assert-True ((Get-DirectoryState $codexHome) -ceq $homeBefore) '-WhatIf must not mutate CODEX_HOME'
        Write-Output 'PASS -WhatIf performs no mutation'
    } finally {
        Remove-Item -LiteralPath $codexHome -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Test-PureSolLunaContracts {
    $skill = [System.IO.File]::ReadAllText((Join-Path $skillDirectory 'SKILL.md'))
    $interfaceMetadata = [System.IO.File]::ReadAllText((Join-Path $skillDirectory 'agents\openai.yaml'))
    $globalRule = [System.IO.File]::ReadAllText((Join-Path $assetsDirectory 'global-agents.md'))
    Assert-True ($skill.Contains('Executor: luna')) 'route line must select Luna'
    Assert-True ($skill.Contains('Tier 3: Sol-Luna-Sol')) 'Tier 3 must retain Sol-Luna-Sol'
    Assert-True (-not ($skill -match '(?i)terra|adaptive')) 'active routing must not mention retired lanes'
    Assert-True (-not ($interfaceMetadata -match '(?i)terra|adaptive')) 'metadata must describe only Sol-Luna'
    Assert-True (-not ($globalRule -match '(?i)terra|adaptive')) 'global rule must describe only Sol-Luna'

    $expectedAgents = @(
        @{ File = 'sol-planner.toml'; Name = 'sol_planner'; Model = 'gpt-6.1-sol'; Effort = 'high'; Sandbox = 'read-only' },
        @{ File = 'sol-compact-planner.toml'; Name = 'sol_compact_planner'; Model = 'gpt-6.1-sol'; Effort = 'medium'; Sandbox = 'read-only' },
        @{ File = 'luna-scout.toml'; Name = 'luna_scout'; Model = 'gpt-6-luna'; Effort = 'low'; Sandbox = 'read-only' },
        @{ File = 'luna-executor.toml'; Name = 'luna_executor'; Model = 'gpt-6-luna'; Effort = 'medium'; Sandbox = 'workspace-write' },
        @{ File = 'luna-fast-executor.toml'; Name = 'luna_fast_executor'; Model = 'gpt-6-luna'; Effort = 'low'; Sandbox = 'workspace-write' }
    )
    foreach ($agent in $expectedAgents) {
        $content = [System.IO.File]::ReadAllText((Join-Path $assetsDirectory $agent.File))
        Assert-True ($content.Contains("name = `"$($agent.Name)`"")) "$($agent.File) name"
        Assert-True ($content.Contains("model = `"$($agent.Model)`"")) "$($agent.File) model"
        Assert-True ($content.Contains("model_reasoning_effort = `"$($agent.Effort)`"")) "$($agent.File) reasoning"
        Assert-True ($content.Contains("sandbox_mode = `"$($agent.Sandbox)`"")) "$($agent.File) sandbox"
    }
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $assetsDirectory 'terra-executor.toml'))) 'retired agent asset must be absent'

    $frontmatter = [regex]::Match($skill, '(?s)\A---\r?\n(.*?)\r?\n---').Groups[1].Value
    Assert-True (([regex]::Matches($frontmatter, '(?m)^[A-Za-z_-]+:')).Count -eq 2) 'Skill frontmatter must remain discovery-only'
    foreach ($file in Get-ChildItem -LiteralPath $skillDirectory -Recurse -File) {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        Assert-True (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) "$($file.Name) must not contain a UTF-8 BOM"
    }
    Write-Output 'PASS pure Sol-Luna routing and agent contracts'
}
Test-DifferingAgentCollisions
Test-FreshInstall
Test-LegacyConfigMigration
Test-RetiredTerraRollback
Test-ProfileDirectoryCollisionAbortsBeforeMutation
Test-PostWriteFailureRestoresExactSnapshot
Test-PureSolLunaContracts
Test-V100Upgrade
Test-V110Upgrade
Test-V110UpgradeWithLaterUnknownCollisionIsAtomic
Test-MalformedGlobalMarkers
Test-IdenticalFilesAreIdempotent
Test-WhatIfDoesNotMutate
Assert-True (-not ([System.IO.File]::ReadAllText($installerPath).Contains('[string]$Profile'))) 'PowerShell installer must remove the Profile interface'
Assert-True (-not (Test-Path -LiteralPath (Join-Path $assetsDirectory 'terra-executor.toml'))) 'Terra asset must be retired'
Write-Output 'ALL TESTS PASSED'
