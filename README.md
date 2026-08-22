# Sol → Luna 自适应任务交接

`sol-luna-handoff` 会先根据改动规模和风险选择成本最低且足以保证质量的执行路线，再自动完成规划、执行与验证。它适用于创建、修改、修复、重构、审查、测试、配置软件或其他项目制品，以及为这些制品编写文档的任务。

当前版本：**v1.1.0**。

## 三级自适应路由

Skill 会在编辑前按固定顺序判定路线，并输出一行 `Route: Tier N - 原因`：

| 级别 | 适用条件 | 执行路线 |
| --- | --- | --- |
| **Tier 1：快速执行** | 同时满足：预计最多 2 个文件、最多 100 行、只涉及 1 个子系统、验收条件明确，且没有 Tier 3 风险。任一边界未知都不会进入 Tier 1。 | `luna_fast_executor`（Luna，低推理）直接实施、自检并检查差异；省略 Sol 规划与验证。 |
| **Tier 2：紧凑规划** | Tier 3 不成立，但至少一项 Tier 1 条件不成立。典型场景是 3～8 个文件或范围明确的跨组件集成。 | `sol_compact_planner`（Sol，中推理）生成不超过 **500 输出 token** 的计划，再由 `luna_executor`（Luna，中推理）实施。 |
| **Tier 3：完整流程** | 预计超过 8 个文件，或涉及安全、认证、权限、密码学、数据迁移、破坏性操作、部署、公共 API、并发、依赖迁移、架构决策、范围不明确，或用户明确要求完整验证。 | `sol_planner`（Sol，高推理）规划 → `luna_executor`（Luna，中推理）实施 → `sol_planner`（Sol，高推理）验证。 |

Tier 2 只在出现以下证据触发条件时追加高推理 Sol 验证：必需检查失败、实际范围超出计划、Luna 报告遗留问题、验收证据不完整，或最终差异偏离计划。没有触发条件时，由 Luna 的新鲜检查、差异检查和自审完成该路线。

四个代理的职责如下：

- `sol_planner`：高推理的完整规划和独立验证。
- `sol_compact_planner`：中推理的紧凑规划，计划上限为 500 输出 token。
- `luna_executor`：中推理的计划执行与自审。
- `luna_fast_executor`：低推理的小型低风险任务直达执行与自验。

两个 Luna 执行器的实施报告均以 **300 输出 token** 为上限；原始命令输出应写入文件，不计入该报告。任务简报、计划和长日志优先通过文件交接，以减少重复上下文。

## 升级与纠偏规则

- 如果执行中发现范围或风险跨入更高级别，先停止继续编辑并升级路线；开始编辑后不降级。
- 验证发现的问题交给同一个 Luna 执行器修正，以保留任务上下文。
- 同一计划下完成 2 轮修正后，先交回适用的 Sol 规划器重新规划，再进行下一轮修正。
- 代理报告 `NEEDS_CONTEXT` 时必须列出确切缺失信息，补齐后再执行。
- 只有新鲜证据满足全部验收条件时才宣告完成。

## 自动触发

随附的安装脚本会在全局 Codex `AGENTS.md` 中写入一个由起止标记界定、可受控维护的规则块。对于创建、修改、修复、重构、审查、测试或配置软件或其他项目制品，或为其编写文档的任务，该规则会加载 `$sol-luna-handoff`，由 Skill 自动选择 Tier 1、Tier 2 或 Tier 3 并推进。

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

写入任何内容之前，安装脚本会先验证全局受控规则块的状态，并预检四个自定义代理的全部目标文件。若目标文件与随附定义逐字节相同，脚本会原样保留，不重复写入。除下述已知 v1.0 内置定义外，任一未知内容差异都会使安装在创建、复制或更新任何文件之前停止，并报告发生冲突的路径，因此不会留下部分安装状态。

重复运行 `install-agents.ps1` 时，与随附定义相同的代理文件以及内容未变化的受控规则块都不会被重复写入。脚本还支持 PowerShell 的 `-WhatIf` 预览。

如果新安装的 `sol_planner`、`sol_compact_planner`、`luna_executor` 和 `luna_fast_executor` 没有立即出现在可用列表中，请新建一个 Codex 任务以刷新发现状态。

## 从 v1.0 升级到 v1.1

在已克隆仓库的上级目录运行以下脚本。它会先备份原 Skill 目录，再安装 v1.1 Skill 并运行新版代理安装器：

```powershell
Push-Location ".\sol-luna-handoff"
git pull

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillTarget = Join-Path $CodexHome "skills\sol-luna-handoff"
$BackupTarget = "$SkillTarget.v1.0-backup"

if (Test-Path -LiteralPath $BackupTarget) {
    throw "Backup already exists at $BackupTarget. Move or remove it before upgrading."
}

Copy-Item -LiteralPath $SkillTarget -Destination $BackupTarget -Recurse
Remove-Item -LiteralPath $SkillTarget -Recurse -Force
Copy-Item -LiteralPath ".\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1")

Pop-Location
```

唯一的自动迁移例外是已知 v1.0 `luna-executor.toml` 的内置 LF 或 CRLF 字节定义；新版安装器会将其升级为 v1.1 定义，同时新增两个代理并更新受控全局规则块。若现有代理文件包含用户自定义内容或其他未知差异，预检会在代理或全局规则发生任何写入前停止并报告冲突；此时可从备份目录恢复或手动合并配置。

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
        │   ├── luna-fast-executor.toml
        │   ├── sol-compact-planner.toml
        │   └── sol-planner.toml
        ├── scripts/install-agents.ps1
        └── tests/install-agents.tests.ps1
```

## 卸载

以下脚本只会移除全局 `AGENTS.md` 中由本项目管理的规则块、四个已安装且仍与随附定义一致的自定义代理文件，以及已安装的 Skill 目录。全局 `AGENTS.md` 中的其他内容会保留。

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
        Installed = Join-Path $CodexHome "agents\sol-compact-planner.toml"
        Bundled = Join-Path $SkillTarget "assets\sol-compact-planner.toml"
    },
    @{
        Installed = Join-Path $CodexHome "agents\luna-executor.toml"
        Bundled = Join-Path $SkillTarget "assets\luna-executor.toml"
    },
    @{
        Installed = Join-Path $CodexHome "agents\luna-fast-executor.toml"
        Bundled = Join-Path $SkillTarget "assets\luna-fast-executor.toml"
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
