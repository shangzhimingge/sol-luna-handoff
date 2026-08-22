# Sol → Luna 任务交接

`sol-luna-handoff` 通过三个阶段处理软件及其他项目制品相关工作：

1. **Sol 规划**：明确工作范围、约束条件、检查项和验收标准。
2. **Luna 执行**：严格按照已批准的计划实施，并报告变更内容与验证证据。
3. **Sol 验证**：逐项对照验收标准检查结果；如有偏差，给出聚焦且可执行的修正意见。

当前版本：**v1.0.0**。

## 自动触发

随附的安装脚本会在全局 Codex `AGENTS.md` 中写入一个由起止标记界定、可受控维护的规则块。对于创建、修改、修复、重构、审查、测试或配置软件或其他项目制品，或为其编写文档的任务，该规则会加载 `$sol-luna-handoff`。

不涉及项目制品修改的一般问答、翻译和纯文本写作不在该全局规则的触发范围内。

## 在 Windows 上使用 PowerShell 安装

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

写入任何内容之前，安装脚本会先验证全局受控规则块的状态，并检查两个自定义代理的目标文件。若目标文件与随附定义逐字节相同，脚本会原样保留，不重复写入。若任一目标文件内容不同，安装会在创建、复制或更新任何文件之前停止，并报告发生冲突的路径。重复运行 `install-agents.ps1` 时，与随附定义相同的代理文件以及内容未变化的受控规则块都不会被重复写入。

如果新安装的 `sol_planner` 和 `luna_executor` 代理没有立即出现在可用列表中，请新建一个 Codex 任务以刷新发现状态。

## 手动调用

在任务中直接提及该 Skill：

```text
Use $sol-luna-handoff to implement this change.
```

## 仓库结构

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

## 卸载

以下脚本只会移除全局 `AGENTS.md` 中由本项目管理的规则块、两个已安装且仍与随附定义一致的自定义代理文件，以及已安装的 Skill 目录。全局 `AGENTS.md` 中的其他内容会保留。

对于自定义代理文件，脚本会先比较 SHA-256 哈希：只有内容仍与 Skill 内随附定义一致时才会删除；若内容已经变化，脚本会保留该文件并发出警告，从而避免删除用户修改过的配置。如果随附的对照文件缺失，已安装文件同样会保留。

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

## 许可证

MIT
