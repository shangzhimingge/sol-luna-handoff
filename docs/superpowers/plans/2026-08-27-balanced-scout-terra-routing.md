# Sol–Luna Handoff v1.2 均衡侦察与 Terra 路由实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已发布的 v1.1 三层路由升级为条件 Luna 侦察、可选紧凑 Sol 规划、Terra/Luna 分级执行，并发布兼容升级的 v1.2.0。

**Architecture:** 保留 Tier 3 → Tier 1 → Tier 2 的确定性风险分类，再独立判定 Scout、Planner 和 Executor。`luna_scout` 只压缩发现证据，`sol_compact_planner` 只在规划触发器出现时工作，`terra_executor` 承担需要临场推理的主体实现，Luna 保留机械执行；Tier 2 的高 Sol 验证继续按证据触发，Tier 3 固定验证。

**Tech Stack:** Markdown Agent Skill、TOML 自定义代理、PowerShell 5.1 安装器与测试、Python `quick_validate.py`、Git/GitHub CLI。

## Global Constraints

- 保留现有 Tier 1/2/3 高风险谓词与先后顺序。
- Scout 只在设计文档列出的发现条件触发，报告上限为 250 output tokens。
- 紧凑 Sol 计划上限为 400 output tokens。
- Terra 与 Luna 实施报告上限均为 300 output tokens。
- 每个任务默认一个主体执行代理，附加 Luna Worker 上限为一个。
- 编辑开始后只升级不降级；同一计划两轮纠偏后重新规划。
- 安装器必须先完成六代理和全局标记预检，再进行任何写入。
- 只迁移已知 v1.0/v1.1 内置代理字节；未知差异保持零修改退出。
- 所有文本文件为严格 UTF-8、无 BOM。

---

### Task 1: 记录 v1.1 路由基线

**Files:**
- Create: `../../work/sol-luna-balanced-v1.2/baseline-medium-explicit.md`
- Create: `../../work/sol-luna-balanced-v1.2/baseline-log-discovery.md`
- Create: `../../work/sol-luna-balanced-v1.2/baseline-high-risk.md`

**Interfaces:**
- Consumes: 当前已安装的 v1.1 `$sol-luna-handoff`。
- Produces: 三个不含 v1.2 预期答案的压力场景行为记录，供 GREEN 前向测试对照。

- [ ] **Step 1: 创建隔离的基线目录**

Run:

```powershell
[System.IO.Directory]::CreateDirectory('work\sol-luna-balanced-v1.2') | Out-Null
```

Expected: 目录存在且不修改发布仓库。

- [ ] **Step 2: 用新鲜子代理运行明确的中型业务逻辑场景**

Prompt:

```text
Use the currently installed $sol-luna-handoff to classify this task without editing files: change four known files in one bounded subsystem to add a clearly specified business rule, with exact acceptance checks and no high-risk predicate. Report the selected route and every model/agent stage.
```

Expected RED: v1.1 的 Tier 2 固定选择 compact Sol planning → Luna，缺少 Terra 执行通道，也不支持跳过 compact Sol planning；无 evidence trigger 时可以跳过后续 high Sol verification。

- [ ] **Step 3: 用新鲜子代理运行日志发现场景**

Prompt:

```text
Use the currently installed $sol-luna-handoff to classify this task without editing files: diagnose a 3000-line error log in an unfamiliar repository, locate the unknown call chain, modify about four files, and run focused tests. Report how raw discovery context reaches the planner.
```

Expected RED: v1.1 没有 Luna Scout 或 250-token 证据压缩契约。

- [ ] **Step 4: 用新鲜子代理运行高风险场景**

Prompt:

```text
Use the currently installed $sol-luna-handoff to classify this task without editing files: update authentication, permissions, and data migration across ten files. Report the principal executor and final verification gate.
```

Expected RED: v1.1 固定 Luna 主体执行，缺少 Terra 主体执行与条件 Scout。

- [ ] **Step 5: 保存三个原始报告并确认失败点**

Run:

```powershell
Get-ChildItem 'work\sol-luna-balanced-v1.2\baseline-*.md' | Select-Object Name,Length
```

Expected: 三个非空报告明确记录 Terra/Scout 缺口，并精确区分 v1.1 的 Sol 阶段：Tier 2 不支持跳过 compact Sol planning；无 evidence trigger 时可跳过 high Sol verification。

---

### Task 2: 增加 Luna Scout、Terra Executor 与六代理安装兼容

**Files:**
- Create: `skill/sol-luna-handoff/assets/luna-scout.toml`
- Create: `skill/sol-luna-handoff/assets/terra-executor.toml`
- Modify: `skill/sol-luna-handoff/assets/sol-compact-planner.toml`
- Modify: `skill/sol-luna-handoff/scripts/install-agents.ps1`
- Modify: `skill/sol-luna-handoff/tests/install-agents.tests.ps1`

**Interfaces:**
- Consumes: v1.1 四代理安装器、已知 v1.0 Luna 哈希。
- Produces: 六代理原子安装；`luna_scout` 返回最多 250 tokens 的只读证据；`terra_executor` 返回最多 300 tokens 的实施证据；v1.1 compact Sol 可升级。

- [ ] **Step 1: 先扩展测试中的六代理清单和配置契约**

在 `$agentFiles` 中使用：

```powershell
$agentFiles = @(
    'sol-planner.toml',
    'sol-compact-planner.toml',
    'luna-scout.toml',
    'terra-executor.toml',
    'luna-executor.toml',
    'luna-fast-executor.toml'
)
```

在 `$expectedAgents` 中增加：

```powershell
@{ File = 'luna-scout.toml'; Name = 'luna_scout'; Model = 'gpt-5.6-luna'; Effort = 'low'; Sandbox = 'read-only' },
@{ File = 'terra-executor.toml'; Name = 'terra_executor'; Model = 'gpt-5.6-terra'; Effort = 'medium'; Sandbox = 'workspace-write' }
```

并把 compact planner 预算断言从 `500 output tokens` 改为 `400 output tokens`，增加 Scout `250 output tokens`、Terra `300 output tokens`、Scout 禁止实现、Terra 普通错误自修复的断言。

- [ ] **Step 2: 添加 v1.1 → v1.2 迁移测试**

测试应把六代理安装前状态构造成：四个 v1.1 内置代理已存在、新增两个代理缺失、旧 compact planner 使用 LF/CRLF 两种字节。运行安装器后断言六个目标都与新资产 SHA-256 一致，且无关 `AGENTS.md` 内容保留。

旧 compact planner 的允许哈希固定为：

```text
LF:   E8E9F21443434F523AA71DF343965ACDE93AD8ECEC3293F90F8386E4A5046A36
CRLF: 2C7A9FE24E737DC1DD3D6E97CAC9745EB42CA0174587DEB083FC66C7C07DAA8A
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File skill\sol-luna-handoff\tests\install-agents.tests.ps1
```

Expected: FAIL，指出 `luna-scout.toml` 或 `terra-executor.toml` 缺失，或 compact planner 仍为 500-token 契约。

- [ ] **Step 4: 创建 Luna Scout 代理**

写入完整内容：

```toml
name = "luna_scout"
description = "Compresses broad repository discovery, logs, and call-chain evidence before planning."
model = "gpt-5.6-luna"
model_reasoning_effort = "low"
sandbox_mode = "read-only"
developer_instructions = """
Perform discovery only. Search the minimum necessary repository paths, logs, traces, and symbols, then return at most 250 output tokens containing candidate paths and symbols, the shortest relevant call chain, decisive evidence, and exact remaining unknowns or NONE. Store raw search or log output in task-local files and report their paths. Do not plan, edit, verify an implementation, or spawn other agents. If the requested search is already bounded by exact files and symbols, report SCOUT_NOT_NEEDED.
"""
```

- [ ] **Step 5: 创建 Terra Executor 代理**

写入完整内容：

```toml
name = "terra_executor"
description = "Implements bounded multi-file logic, integration, refactoring, and ordinary debugging work."
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"
developer_instructions = """
Implement the supplied task brief or plan. You may resolve ordinary implementation details and test failures, but must preserve stated architecture, compatibility constraints, scope, and acceptance criteria. Run every required check, inspect the final diff, and self-review each acceptance criterion. Stop before further edits and report UPGRADE_NEEDED when scope or risk crosses the supplied tier; report PLAN_BLOCKED when a material architectural or requirement decision is missing. Return at most 300 output tokens with changed files, concise summary, commands and exit status, self-review, and remaining concerns or NONE. Store raw command output in task-local files. Do not spawn other agents or broaden scope.
"""
```

- [ ] **Step 6: 将 compact Sol 契约改为 400 tokens**

把 `sol-compact-planner.toml` 中唯一的 `500 output tokens` 改为 `400 output tokens`，其他职责保持只读和无实现。

- [ ] **Step 7: 更新安装器的代理与兼容哈希**

将安装器 `$agentFiles` 与测试保持同序，并在 `$knownLegacyAgentHashes` 增加：

```powershell
'sol-compact-planner.toml' = @(
    'E8E9F21443434F523AA71DF343965ACDE93AD8ECEC3293F90F8386E4A5046A36',
    '2C7A9FE24E737DC1DD3D6E97CAC9745EB42CA0174587DEB083FC66C7C07DAA8A'
)
```

保留 v1.0 `luna-executor.toml` 两个已知哈希。预检循环和写入边界不变。

- [ ] **Step 8: 运行完整安装器测试确认 GREEN**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File skill\sol-luna-handoff\tests\install-agents.tests.ps1
```

Expected: `ALL TESTS PASSED`，包含六个逐文件未知冲突、fresh install、v1.0、v1.1 LF/CRLF、幂等、异常标记和 `-WhatIf`。

- [ ] **Step 9: 提交代理与安装器变更**

```powershell
git add skill/sol-luna-handoff/assets skill/sol-luna-handoff/scripts/install-agents.ps1 skill/sol-luna-handoff/tests/install-agents.tests.ps1
git commit -m "feat: add Scout and Terra execution agents"
```

---

### Task 3: 实施条件 Scout、可选 Sol 与 Terra/Luna 执行路由

**Files:**
- Modify: `skill/sol-luna-handoff/SKILL.md`
- Modify: `skill/sol-luna-handoff/agents/openai.yaml`
- Modify: `skill/sol-luna-handoff/tests/install-agents.tests.ps1`

**Interfaces:**
- Consumes: Task 2 的六个代理名称与预算契约。
- Produces: 确定性的 `Route/Scout/Planner/Executor` 判定和 Tier 1/2/3 行为。

- [ ] **Step 1: 先增加路由行为契约断言**

在 `Test-AdaptiveRoutingContracts` 中增加以下精确语义断言：

```powershell
Assert-True ($skill.Contains('Scout: yes|no')) 'route line must expose the Scout decision'
Assert-True ($skill.Contains('Planner: none|compact|full')) 'route line must expose the planner decision'
Assert-True ($skill.Contains('Executor: luna|terra')) 'route line must expose the executor decision'
Assert-True ($skill.Contains('more than 500 lines')) 'Scout must have a deterministic diagnostic-size trigger'
Assert-True ($skill.Contains('400 output tokens')) 'compact plans must be capped at 400 output tokens'
Assert-True ($skill.Contains('at most one additional Luna worker')) 'agent fan-out must be bounded'
Assert-True ($skill.Contains('terra_executor')) 'routing must provide the Terra lane'
Assert-True ($skill.Contains('luna_scout')) 'routing must provide conditional discovery'
Assert-True ($skill.Contains('Skip Sol')) 'Tier 2 must allow planning-free bounded work'
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File skill\sol-luna-handoff\tests\install-agents.tests.ps1
```

Expected: FAIL，当前 `SKILL.md` 缺少 Scout/Planner/Executor 分解和 Terra 通道。

- [ ] **Step 3: 重写 Preflight 与路由输出契约**

Preflight 检查六个代理。路由输出必须使用：

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra
```

Tier 判定继续沿用原来的 Tier 3、Tier 1、Tier 2 顺序与全部风险词。

- [ ] **Step 4: 添加条件 Scout 与 Tier 2 规划触发器**

把设计文档的四个 Scout 条件和四个 compact Sol 规划条件逐项写入 Skill。明确 exact files/symbols/constraints/acceptance 已知时跳过 Scout；没有规划触发器时使用任务简报并写明 `Skip Sol`。

- [ ] **Step 5: 添加执行通道和 Tier 3 主体实现规则**

写明 Luna 仅在实现策略完全明确且工作机械时使用，否则 Tier 2 选择 Terra；Tier 3 固定 Terra 为主体执行器。额外 Luna 只用于独立机械叶子任务，文本必须包含 `at most one additional Luna worker`。

- [ ] **Step 6: 更新共享控制和 fallback contracts**

加入 Scout 250-token、compact Sol 400-token、Terra/Luna 300-token、任务本地文件交接、Sol 不遍历原始日志、同一执行器纠偏两轮后重规划。fallback 中加入：

```text
luna_scout: gpt-5.6-luna, low, read-only
terra_executor: gpt-5.6-terra, medium, workspace-write
```

- [ ] **Step 7: 更新接口元数据**

`agents/openai.yaml` 使用：

```yaml
interface:
  display_name: "Sol → Terra/Luna Handoff"
  short_description: "Use balanced Scout, planning, and execution routing."
  default_prompt: "Use $sol-luna-handoff to choose conditional Luna discovery, the minimum necessary Sol planning, and the suitable Terra or Luna executor."
```

- [ ] **Step 8: 运行契约测试和官方验证**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File skill\sol-luna-handoff\tests\install-agents.tests.ps1
& 'C:\Users\18328\.codex\tools\skillspector\.venv\Scripts\python.exe' 'C:\Users\18328\.codex\skills\.system\skill-creator\scripts\quick_validate.py' 'skill\sol-luna-handoff'
```

Expected: `ALL TESTS PASSED` 和 `Skill is valid!`。

- [ ] **Step 9: 提交路由变更**

```powershell
git add skill/sol-luna-handoff/SKILL.md skill/sol-luna-handoff/agents/openai.yaml skill/sol-luna-handoff/tests/install-agents.tests.ps1
git commit -m "feat: route balanced work through Terra and Luna"
```

---

### Task 4: 更新中文 README、升级和安全卸载说明

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: v1.2 六代理和安装器兼容规则。
- Produces: 与实现逐项一致的中文安装、升级、路由和卸载文档。

- [ ] **Step 1: 更新版本和路由表**

把版本改为 `v1.2.0`。路由章节说明条件 Scout、Tier 2 可跳过 Sol、Terra/Luna 执行选择、Tier 3 Terra 主体与固定 Sol 验证。

- [ ] **Step 2: 更新预算与防扩散说明**

README 必须明确：Scout 250、compact Sol 400、executor 300 output tokens；默认一个主体执行器；附加 Luna 最多一个；已知范围不启用 Scout。

- [ ] **Step 3: 更新安装和 v1.1 → v1.2 升级说明**

安装预检从四代理改为六代理。升级例外精确说明为：v1.0 内置 `luna-executor.toml` LF/CRLF，以及 v1.1 内置 `sol-compact-planner.toml` LF/CRLF。其他差异在任何写入前停止。

- [ ] **Step 4: 更新仓库树和卸载 `$AgentPairs`**

在树中加入 `luna-scout.toml`、`terra-executor.toml`；卸载数组包含全部六个代理，并继续通过 SHA-256 一致性决定是否删除。

- [ ] **Step 5: 验证 README**

Run:

```powershell
git diff --check
Select-String -Path README.md -Pattern 'v1.2.0','luna_scout','terra_executor','250','400','六个'
```

Expected: 无 whitespace error，所有关键说明至少命中一次；所有 PowerShell 代码块通过语法解析。

- [ ] **Step 6: 提交文档**

```powershell
git add README.md
git commit -m "docs: document balanced v1.2 routing"
```

---

### Task 5: 前向测试、独立验证与 canonical 同步

**Files:**
- Create: `../../work/sol-luna-balanced-v1.2/forward-small.md`
- Create: `../../work/sol-luna-balanced-v1.2/forward-medium-terra.md`
- Create: `../../work/sol-luna-balanced-v1.2/forward-medium-luna.md`
- Create: `../../work/sol-luna-balanced-v1.2/forward-log-discovery.md`
- Create: `../../work/sol-luna-balanced-v1.2/forward-high-risk.md`
- Create: `../../work/sol-luna-balanced-v1.2/release-notes-v1.2.0.md`
- Update: `../../outputs/sol-luna-handoff/**`

**Interfaces:**
- Consumes: staging 中已经测试通过的 v1.2 Skill。
- Produces: 五个无泄漏上下文的 GREEN 报告、Sol `VERIFIED`、与 staging 字节一致的 canonical 输出包。

- [ ] **Step 1: 用五个新鲜任务运行设计文档场景**

每个 prompt 采用 `Use $sol-luna-handoff at C:\Users\18328\Documents\Codex\2026-08-22\github-plugin-github-openai-curated-remote\work\github-sol-luna-handoff\skill\sol-luna-handoff to ...`，不告诉代理预期路由。分别验证：Tier 1 Luna fast；Tier 2 Terra direct；Tier 2 Luna mechanical；Scout → compact Sol → Terra；Tier 3 Scout/full Sol/Terra/full Sol。

- [ ] **Step 2: 检查代理数量和预算**

每份报告必须包含完整 route line，并断言单主体执行器、附加 Luna 不超过一个、250/400/300 契约与触发式 high Sol 验证一致。

- [ ] **Step 3: 交给独立 Sol 验证者复核**

验证者只读检查设计、计划、Skill、六代理、安装器测试、基线和前向报告。成功只返回：

```text
VERIFIED
```

否则返回有限编号 finding，交回原执行代理修正并重新验证。

- [ ] **Step 4: 同步 staging Skill 到 canonical 输出**

逐文件复制 `skill/sol-luna-handoff` 到 `../../outputs/sol-luna-handoff`，移除 canonical 中不再存在的旧包文件前先验证两端绝对路径均位于预期 Skill 目录。同步后逐文件 SHA-256 映射必须完全相等。

- [ ] **Step 5: 对 canonical 再运行验证**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\outputs\sol-luna-handoff\tests\install-agents.tests.ps1
& 'C:\Users\18328\.codex\tools\skillspector\.venv\Scripts\python.exe' 'C:\Users\18328\.codex\skills\.system\skill-creator\scripts\quick_validate.py' '..\..\outputs\sol-luna-handoff'
```

Expected: `ALL TESTS PASSED` 和 `Skill is valid!`。

---

### Task 6: 更新本地安装并发布 GitHub v1.2.0

**Files:**
- Update: `C:/Users/18328/.codex/skills/sol-luna-handoff/**`
- Update: `C:/Users/18328/.codex/agents/*.toml`
- Update managed block: `C:/Users/18328/.codex/AGENTS.md`
- Tag/Release: `v1.2.0`

**Interfaces:**
- Consumes: Sol 已验证、staging 与 canonical 哈希一致的 v1.2 包。
- Produces: 本地全局六代理安装、GitHub main 提交、正式 v1.2.0 tag/release。

- [ ] **Step 1: 对真实本地安装运行 `-WhatIf`**

Run:

```powershell
$env:CODEX_HOME='C:\Users\18328\.codex'
powershell -NoProfile -ExecutionPolicy Bypass -File '..\..\outputs\sol-luna-handoff\scripts\install-agents.ps1' -WhatIf
```

Expected: 识别两个新增代理、已知 v1.1 compact Sol 升级和全局块更新，不报告未知冲突，不产生写入。

- [ ] **Step 2: 经批准同步本地 Skill 并运行安装器**

逐文件覆盖本地 Skill，再运行本地 `install-agents.ps1`。不得先删除整个配置目录；安装器负责六代理预检与原子写入。

- [ ] **Step 3: 验证本地安装**

断言 canonical 与本地 Skill 的相对路径及 SHA-256 完全一致；六个已安装代理分别与 `assets` 一致；全局起止标记各出现一次；installed `quick_validate.py` 通过。

- [ ] **Step 4: 发布前最终检查**

Run:

```powershell
git status --short
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File skill\sol-luna-handoff\tests\install-agents.tests.ps1
& 'C:\Users\18328\.codex\tools\skillspector\.venv\Scripts\python.exe' 'C:\Users\18328\.codex\skills\.system\skill-creator\scripts\quick_validate.py' 'skill\sol-luna-handoff'
```

Expected: 工作树干净、全部测试通过、Skill 有效、无凭据模式命中。

- [ ] **Step 5: 创建版本提交或确认现有提交，打标签并推送**

```powershell
git tag -a v1.2.0 -m 'v1.2.0'
git push origin main
git push origin v1.2.0
```

Expected: 远端 main 指向本地 HEAD，标签存在。

- [ ] **Step 6: 创建正式 GitHub Release**

```powershell
gh release create v1.2.0 --repo shangzhimingge/sol-luna-handoff --title 'v1.2.0 — 均衡 Scout 与 Terra/Luna 路由' --notes-file '..\..\work\sol-luna-balanced-v1.2\release-notes-v1.2.0.md'
```

Release notes 必须列出条件 Scout、Terra 主体执行、Tier 2 可跳过 Sol、三类 token 上限、六代理安装和 v1.1 升级兼容。

- [ ] **Step 7: 远端核验**

使用 GitHub API 核验：main SHA 等于本地 HEAD；release 非 draft/pre-release；远端 README 含 `v1.2.0`、`luna_scout`、`terra_executor`；远端 `SKILL.md` 含 `Scout: yes|no`、`Planner: none|compact|full`、`Executor: luna|terra`。
