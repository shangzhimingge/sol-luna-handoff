# Sol–Terra/Luna 自适应任务交接

`sol-luna-handoff` 面向会创建、修改、修复、重构、审查、测试、配置或记录项目制品的 Codex 任务。它按风险和范围选择最低成本且足以保证质量的路线，并自动完成发现、规划、执行与验证。

当前版本：**v1.2.0**。

## v1.2 的均衡路由

Skill 严格按 **Tier 3 → Tier 1 → Tier 2** 的顺序分类。仅 Scout 可以在最终路线确定前运行；Scout 完成或明确跳过后，Skill 会在首次 Planner 或 Executor 委派前输出唯一一行最终路线：

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra
```

| 级别 | 精确条件 | 默认路线 |
| --- | --- | --- |
| **Tier 1：快速执行** | 同时满足：预计最多 2 个文件、最多 100 行、恰好 1 个子系统、验收条件明确，且没有 Tier 3 风险。任一边界未知都不进入 Tier 1。 | `Scout: no; Planner: none; Executor: luna`。由 `luna_fast_executor` 直接实施、自检并检查差异。 |
| **Tier 2：均衡执行** | Tier 3 不成立，但至少一个 Tier 1 条件不成立；包括边界明确的 3～8 文件工作与跨组件集成。 | 按条件运行 `luna_scout`；规划触发器成立时用 `sol_compact_planner`，否则跳过 **compact Sol planning**；机械工作用 Luna，其余工作用 Terra；高推理 Sol 验证仅由新鲜证据触发。 |
| **Tier 3：完整流程** | 预计超过 8 个文件，或涉及安全、认证、权限、密码学、数据迁移、破坏性操作、部署、公共 API、并发、依赖迁移、架构决策、无法界定的需求/范围，或用户明确要求完整验证。 | Scout 仅按条件运行；固定 `sol_planner` 完整规划 → `terra_executor` 主体执行 → `sol_planner` 高推理最终验证。 |

Tier 2 的 `Planner: none` 只表示跳过 compact Sol planning。执行后若出现证据触发器，仍会调用高推理 `sol_planner` 验证。

## 条件 Scout

Tier 1 固定 `Scout: no`。Tier 2 和 Tier 3 仅在以下任一发现条件成立时调用只读 `luna_scout`：

- 相关文件或关键符号尚未定位，且搜索必须跨越一个以上子系统；
- 日志、跟踪或报错材料超过 500 行；
- 调用链跨过哪些模块尚不清楚；
- Planner 原本需要进行宽泛的仓库搜索。

精确文件、符号、约束和验收条件均已知时不启用 Scout。Scout 只返回候选路径与符号、最短调用链、关键证据和剩余未知，并将原始搜索或日志输出写入任务本地文件。

## Tier 2 的 Planner 与 Executor 选择

Tier 2 仅在以下任一条件成立时运行 `sol_compact_planner`：

- Scout 后仍需在多个候选根因或实现方案之间选择；
- 修改跨多个子系统，且存在顺序或依赖关系；
- 存在兼容性约束或新的跨文件不变量；
- 验收条件允许多种实现，且取舍会实质影响结果。

没有上述触发器时，协调者直接生成明确任务简报并记录 `Planner: none`。

执行边界如下：

- `luna_executor`：策略完全明确，且属于本地、机械、重复、配置、测试或文档编辑；无需推导跨文件不变量，也无需处理未知测试失败。
- `terra_executor`：其余 Tier 2 工作，包括多文件业务逻辑、集成、重构和常规调试。

Tier 2 仅在新鲜必需检查失败、范围超出任务简报/计划、执行器报告遗留问题、验收证据不完整或差异偏离任务简报/计划时追加高推理 Sol 验证。没有证据触发器时，主体执行器的新鲜检查、差异检查和自审即可完成路线。

## 六个自定义代理

| 代理 | 模型与权限 | 职责 | 输出预算 |
| --- | --- | --- | --- |
| `luna_scout` | Luna / low / read-only | 压缩跨仓库发现、长日志和调用链证据 | 最多 **250 output tokens** |
| `sol_compact_planner` | Sol / medium / read-only | Tier 2 的范围、步骤、文件、检查与验收计划 | 最多 **400 output tokens** |
| `sol_planner` | Sol / high / read-only | Tier 3 完整规划，以及证据触发或固定最终验证 | 有界规划或结论 |
| `terra_executor` | Terra / medium / workspace-write | 多文件逻辑、集成、重构和常规调试 | 最多 **300 output tokens** |
| `luna_executor` | Luna / medium / workspace-write | 明确、机械的任务简报或计划执行 | 最多 **300 output tokens** |
| `luna_fast_executor` | Luna / low / workspace-write | Tier 1 直接执行与自验 | 最多 **300 output tokens** |

原始命令输出写入任务本地文件，不计入执行报告预算。Sol 读取压缩证据与必要文件，不承担宽泛仓库遍历、原始日志筛查、常规编码或普通测试修复循环。

## 防止代理与上下文扩散

- 默认每个任务只有一个主体执行器。
- Tier 3 仅可为完全有界、可独立并行且能减少总上下文的机械叶子任务增加 **最多一个 Luna worker**；主体仍固定为 Terra。
- Scout、计划和执行证据均通过任务本地文件交接，只传递相关路径与压缩摘要。
- 同一任务简报或计划下的普通修正交回同一执行器；完成 2 轮修正后先重新规划，再继续编辑。
- Tier 2 的 `Planner: none` 路线在第 2 轮修正后先调用 compact Sol；Tier 1 则升级到至少 Tier 2 后调用 compact Sol。
- 范围或风险跨入更高级别时先停止编辑并升级，编辑开始后不降级。

## 自动全局触发

安装器会在全局 Codex `AGENTS.md` 中维护一个由起止标记界定的规则块。创建、修改、修复、重构、审查、测试、配置项目制品或为项目制品编写文档时，该规则会加载 `$sol-luna-handoff`，由 Skill 自动选路并继续执行。

一般问答、翻译和不修改项目制品的纯文本写作不在全局触发范围内。

## Windows PowerShell 安装

```powershell
git clone https://github.com/shangzhimingge/sol-luna-handoff.git

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillsDirectory = Join-Path $CodexHome "skills"
$SkillTarget = Join-Path $SkillsDirectory "sol-luna-handoff"

if (Test-Path -LiteralPath $SkillTarget) {
    throw "The skill is already installed at $SkillTarget. Use the upgrade procedure for an existing copy."
}

New-Item -ItemType Directory -Path $SkillsDirectory -Force | Out-Null
Copy-Item -LiteralPath ".\sol-luna-handoff\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1")
```

写入前，安装器会先验证全局受控规则块，并预检六个代理的全部目标文件。目标与随附定义逐字节一致时原样保留。除下节列出的已知旧版字节定义外，任何未知差异都会让预检在创建、复制或更新文件前停止，因此不会形成部分安装状态。脚本支持 `-WhatIf`，重复执行保持幂等。

新安装的 `sol_planner`、`sol_compact_planner`、`luna_scout`、`terra_executor`、`luna_executor` 和 `luna_fast_executor` 若尚未出现在可用代理列表中，新建一个 Codex 任务即可刷新发现状态。

## 从 v1.1 升级到 v1.2

在已克隆仓库的上级目录运行以下脚本。它会先更新仓库，再备份已安装的 v1.1 Skill，复制 v1.2 Skill，并运行六代理安装器。

```powershell
Push-Location ".\sol-luna-handoff"
git pull

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillTarget = Join-Path $CodexHome "skills\sol-luna-handoff"
$BackupTarget = "$SkillTarget.v1.1-backup"

if (Test-Path -LiteralPath $BackupTarget) {
    throw "Backup already exists at $BackupTarget. Move or remove it before upgrading."
}

Copy-Item -LiteralPath $SkillTarget -Destination $BackupTarget -Recurse
Remove-Item -LiteralPath $SkillTarget -Recurse -Force
Copy-Item -LiteralPath ".\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1")

Pop-Location
```

安装器只接受以下内置旧版代理的精确 UTF-8 字节定义作为自动迁移例外：

- v1.0 内置 `luna-executor.toml` 的 LF 或 CRLF 版本；
- v1.1 内置 `sol-planner.toml`、`sol-compact-planner.toml`、`luna-executor.toml` 和 `luna-fast-executor.toml` 的 LF 或 CRLF 版本。

匹配时，安装器会升级相应定义并补齐新代理。其他代理差异、用户自定义内容或未知版本会在任何写入前报告冲突；此时应从备份恢复，或人工核对并合并配置。

## 手动调用

在任务中直接提及 Skill：

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
        │   ├── luna-scout.toml
        │   ├── sol-compact-planner.toml
        │   ├── sol-planner.toml
        │   └── terra-executor.toml
        ├── scripts/install-agents.ps1
        └── tests/install-agents.tests.ps1
```

## 安全卸载

以下脚本移除全局 `AGENTS.md` 中由本项目管理的规则块、仍与随附定义一致的六个代理文件，以及已安装的 Skill 目录。全局文件中的其他内容会保留。

代理文件删除前会比较 SHA-256：内容与 Skill 中的随附定义一致时才删除；内容已变化或随附对照文件缺失时保留并发出警告。

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
        Installed = Join-Path $CodexHome "agents\luna-scout.toml"
        Bundled = Join-Path $SkillTarget "assets\luna-scout.toml"
    },
    @{
        Installed = Join-Path $CodexHome "agents\terra-executor.toml"
        Bundled = Join-Path $SkillTarget "assets\terra-executor.toml"
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

Remove-Item -LiteralPath $SkillTarget -Recurse -Force -ErrorAction SilentlyContinue
```

## 许可证

MIT
