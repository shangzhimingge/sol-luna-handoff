# Sol → Luna Handoff

`sol-luna-handoff` routes project-artifact work through a three-stage workflow:

1. **Sol plans** the work and defines scope, constraints, checks, and acceptance criteria.
2. **Luna executes** the approved plan and reports changes and verification evidence.
3. **Sol verifies** the result against every acceptance criterion, returning focused corrections when needed.

Current release: **v1.0.0**.

## Automatic triggering

The included installer adds a marker-delimited managed block to the global Codex `AGENTS.md`. That rule loads `$sol-luna-handoff` for tasks that create, modify, fix, refactor, review, test, configure, or document software or other project artifacts.

The global rule excludes general Q&A, translation, and prose-only work that does not modify a project artifact.

## Install on Windows with PowerShell

```powershell
git clone https://github.com/shangzhimingge/sol-luna-handoff.git

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillsDirectory = Join-Path $CodexHome "skills"
$SkillTarget = Join-Path $SkillsDirectory "sol-luna-handoff"

if (Test-Path -LiteralPath $SkillTarget) {
    throw "The skill is already installed at $SkillTarget. Uninstall it before installing this copy."
}

New-Item -ItemType Directory -Path $SkillsDirectory -Force | Out-Null
Copy-Item -LiteralPath ".\sol-luna-handoff\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1")
```

Before writing anything, the installer validates the global managed-block state and checks both custom-agent destinations. A destination containing the same bytes as the bundled definition is left untouched. If either destination contains different content, installation stops before creating, copying, or updating any files and reports the colliding path.

Start a fresh Codex task if the newly installed `sol_planner` and `luna_executor` agents are not immediately discoverable.

## Manual invocation

Mention the skill directly in a task:

```text
Use $sol-luna-handoff to implement this change.
```

## Repository layout

```text
.
├── README.md
├── LICENSE
└── skill/
    └── sol-luna-handoff/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── assets/
        │   ├── global-agents.md
        │   ├── luna-executor.toml
        │   └── sol-planner.toml
        ├── scripts/install-agents.ps1
        └── tests/install-agents.tests.ps1
```

## Uninstall

The following removes only the managed global rule block, the two installed custom-agent files, and the installed skill directory. Other global `AGENTS.md` content is preserved.

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$GlobalAgentsPath = Join-Path $CodexHome "AGENTS.md"
$StartMarker = '<!-- BEGIN SOL-LUNA-HANDOFF MANAGED BLOCK -->'
$EndMarker = '<!-- END SOL-LUNA-HANDOFF MANAGED BLOCK -->'

if (Test-Path -LiteralPath $GlobalAgentsPath) {
    $Utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
    $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    $Content = [System.IO.File]::ReadAllText($GlobalAgentsPath, $Utf8Strict)
    $Pattern = '(?ms)^[ \t]*' + [regex]::Escape($StartMarker) + '[ \t]*\r?\n.*?^[ \t]*' + [regex]::Escape($EndMarker) + '[ \t]*(?:\r?\n)?'
    $Updated = [regex]::new($Pattern).Replace($Content, '', 1)
    [System.IO.File]::WriteAllText($GlobalAgentsPath, $Updated, $Utf8NoBom)
}

$SkillTarget = Join-Path $CodexHome "skills\sol-luna-handoff"
$AgentPairs = @(
    @{
        Installed = Join-Path $CodexHome "agents\sol-planner.toml"
        Bundled = Join-Path $SkillTarget "assets\sol-planner.toml"
    },
    @{
        Installed = Join-Path $CodexHome "agents\luna-executor.toml"
        Bundled = Join-Path $SkillTarget "assets\luna-executor.toml"
    }
)

foreach ($Pair in $AgentPairs) {
    if (-not (Test-Path -LiteralPath $Pair.Installed)) {
        continue
    }

    if (-not (Test-Path -LiteralPath $Pair.Bundled)) {
        Write-Warning "Preserving $($Pair.Installed): bundled comparison file is missing."
        continue
    }

    $InstalledHash = (Get-FileHash -LiteralPath $Pair.Installed -Algorithm SHA256).Hash
    $BundledHash = (Get-FileHash -LiteralPath $Pair.Bundled -Algorithm SHA256).Hash
    if ($InstalledHash -ceq $BundledHash) {
        Remove-Item -LiteralPath $Pair.Installed -Force
    } else {
        Write-Warning "Preserving $($Pair.Installed): its content differs from the bundled definition."
    }
}

Remove-Item -LiteralPath (Join-Path $CodexHome "skills\sol-luna-handoff") -Recurse -Force -ErrorAction SilentlyContinue
```

## License

MIT
