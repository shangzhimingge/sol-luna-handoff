[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'

$skillDirectory = Split-Path -Parent $PSScriptRoot
$codexHome = if ($env:CODEX_HOME) {
    $env:CODEX_HOME
} else {
    Join-Path $HOME '.codex'
}

$agentsDirectory = [System.IO.Path]::GetFullPath((Join-Path $codexHome 'agents'))
$globalAgentsPath = [System.IO.Path]::GetFullPath((Join-Path $codexHome 'AGENTS.md'))
$sourceDirectory = Join-Path $skillDirectory 'assets'
$agentFiles = @('sol-planner.toml', 'luna-executor.toml')
$managedBlockPath = [System.IO.Path]::GetFullPath((Join-Path $sourceDirectory 'global-agents.md'))
$startMarker = '<!-- BEGIN SOL-LUNA-HANDOFF MANAGED BLOCK -->'
$endMarker = '<!-- END SOL-LUNA-HANDOFF MANAGED BLOCK -->'
$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Test-ByteArrayEqual {
    param(
        [Parameter(Mandatory)]
        [byte[]]$Left,

        [Parameter(Mandatory)]
        [byte[]]$Right
    )

    if ($Left.Length -ne $Right.Length) {
        return $false
    }

    for ($index = 0; $index -lt $Left.Length; $index++) {
        if ($Left[$index] -ne $Right[$index]) {
            return $false
        }
    }

    return $true
}

# Preflight every custom-agent destination before making any filesystem changes.
$agentInstallPlans = foreach ($fileName in $agentFiles) {
    $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $sourceDirectory $fileName))
    $destinationPath = [System.IO.Path]::GetFullPath((Join-Path $agentsDirectory $fileName))
    $sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
    $needsWrite = -not [System.IO.File]::Exists($destinationPath)

    if (-not $needsWrite) {
        $destinationBytes = [System.IO.File]::ReadAllBytes($destinationPath)
        if (-not (Test-ByteArrayEqual -Left $sourceBytes -Right $destinationBytes)) {
            throw "Custom-agent collision: destination exists with different content: $destinationPath"
        }
    }

    [pscustomobject]@{
        SourcePath = $sourcePath
        DestinationPath = $destinationPath
        SourceBytes = $sourceBytes
        NeedsWrite = $needsWrite
    }
}

$managedBlock = [System.IO.File]::ReadAllText($managedBlockPath, $utf8Strict)
$escapedStartMarker = [System.Text.RegularExpressions.Regex]::Escape($startMarker)
$escapedEndMarker = [System.Text.RegularExpressions.Regex]::Escape($endMarker)
$managedBlockPattern = "(?ms)\A[ \t]*$escapedStartMarker[ \t]*\r?\n.*?^[ \t]*$escapedEndMarker[ \t]*(?:\r?\n)?\z"
$managedStartMarkerCount = [System.Text.RegularExpressions.Regex]::Matches($managedBlock, "(?m)^[ \t]*$escapedStartMarker[ \t]*\r?$").Count
$managedEndMarkerCount = [System.Text.RegularExpressions.Regex]::Matches($managedBlock, "(?m)^[ \t]*$escapedEndMarker[ \t]*\r?$").Count

if ($managedStartMarkerCount -ne 1 -or
    $managedEndMarkerCount -ne 1 -or
    -not [System.Text.RegularExpressions.Regex]::IsMatch($managedBlock, $managedBlockPattern)) {
    throw "Managed global rule must contain exactly one complete marker-delimited block: $managedBlockPath"
}

$existingGlobalAgents = if ([System.IO.File]::Exists($globalAgentsPath)) {
    [System.IO.File]::ReadAllText($globalAgentsPath, $utf8Strict)
} else {
    ''
}

$newline = if ($existingGlobalAgents.Contains("`r`n")) { "`r`n" } else { "`n" }
$normalizedManagedBlock = ($managedBlock.TrimEnd("`r", "`n") -replace "`r`n|`r|`n", $newline) + $newline
$startMarkerCount = [System.Text.RegularExpressions.Regex]::Matches($existingGlobalAgents, "(?m)^[ \t]*$escapedStartMarker[ \t]*\r?$").Count
$endMarkerCount = [System.Text.RegularExpressions.Regex]::Matches($existingGlobalAgents, "(?m)^[ \t]*$escapedEndMarker[ \t]*\r?$").Count

if ($startMarkerCount -eq 0 -and $endMarkerCount -eq 0) {
    if ($existingGlobalAgents.Length -eq 0) {
        $updatedGlobalAgents = $normalizedManagedBlock
    } elseif ($existingGlobalAgents.EndsWith($newline + $newline)) {
        $updatedGlobalAgents = $existingGlobalAgents + $normalizedManagedBlock
    } elseif ($existingGlobalAgents.EndsWith($newline)) {
        $updatedGlobalAgents = $existingGlobalAgents + $newline + $normalizedManagedBlock
    } else {
        $updatedGlobalAgents = $existingGlobalAgents + $newline + $newline + $normalizedManagedBlock
    }
} elseif ($startMarkerCount -eq 1 -and $endMarkerCount -eq 1) {
    $installedBlockPattern = "(?ms)^[ \t]*$escapedStartMarker[ \t]*\r?\n.*?^[ \t]*$escapedEndMarker[ \t]*(?:\r?\n)?"
    $installedBlockMatch = [System.Text.RegularExpressions.Regex]::Match($existingGlobalAgents, $installedBlockPattern)

    if (-not $installedBlockMatch.Success) {
        throw "Managed global rule markers are malformed in $globalAgentsPath"
    }

    $updatedGlobalAgents = $existingGlobalAgents.Substring(0, $installedBlockMatch.Index) +
        $normalizedManagedBlock +
        $existingGlobalAgents.Substring($installedBlockMatch.Index + $installedBlockMatch.Length)
} else {
    throw "Expected zero or one managed global rule block in $globalAgentsPath"
}

# All collision and marker validation is complete. Mutations begin here.
$missingAgentFiles = @($agentInstallPlans | Where-Object { $_.NeedsWrite })
if ($missingAgentFiles.Count -gt 0 -and
    -not [System.IO.Directory]::Exists($agentsDirectory) -and
    $PSCmdlet.ShouldProcess($agentsDirectory, 'Create custom-agent directory')) {
    [System.IO.Directory]::CreateDirectory($agentsDirectory) | Out-Null
}

foreach ($plan in $agentInstallPlans) {
    if ($plan.NeedsWrite -and
        $PSCmdlet.ShouldProcess($plan.DestinationPath, "Install custom agent from $($plan.SourcePath)")) {
        [System.IO.File]::WriteAllBytes($plan.DestinationPath, $plan.SourceBytes)
    }

    Write-Output $plan.DestinationPath
}

if ($updatedGlobalAgents -cne $existingGlobalAgents -and
    $PSCmdlet.ShouldProcess($globalAgentsPath, "Install managed global rule from $managedBlockPath")) {
    [System.IO.File]::WriteAllText($globalAgentsPath, $updatedGlobalAgents, $utf8NoBom)
}

Write-Output $globalAgentsPath
