# Sol → Terra/Luna Handoff

> **面向 Codex 的成本感知自适应多代理路由 Skill。**
>
> Sol 负责高风险任务的规划与验证，Terra 承担复杂主体实现，Luna 负责快速发现与明确的机械性工作。

[English](./README.md)

![Version](https://img.shields.io/badge/version-v1.3.1-2563eb)
[![CI](https://github.com/shangzhimingge/sol-luna-handoff/actions/workflows/ci.yml/badge.svg)](https://github.com/shangzhimingge/sol-luna-handoff/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-16a34a)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933)
![Codex](https://img.shields.io/badge/Codex-Agent%20Skill-111827)

## 一条命令完成全部安装

```bash
npx -y github:shangzhimingge/sol-luna-handoff
```

这一条命令会安装或安全升级：

```text
~/.codex/skills/sol-luna-handoff/   Skill 本体
~/.codex/agents/*.toml              6 个自定义 Agent
~/.codex/AGENTS.md                  全局自动触发规则块
```

安装后直接正常使用 Codex。受支持的项目制品任务会通过全局规则自动加载 Skill，不需要再运行首次初始化指令。

如果安装时 Codex 已经打开并缓存了 Agent 列表，新建一个 Codex 任务或重启一次应用即可刷新。

### 检查或卸载

```bash
# 只读健康检查
npx -y github:shangzhimingge/sol-luna-handoff doctor

# 安全卸载
npx -y github:shangzhimingge/sol-luna-handoff uninstall
```

若希望固定到指定版本：

```bash
npx -y github:shangzhimingge/sol-luna-handoff#v1.3.1
```

## 它解决什么问题

固定使用高推理流程，会让小任务承担多余成本，也很难同时覆盖大型高风险任务。`sol-luna-handoff` 根据任务的范围和风险进行分类，然后选择成本较低、能力又足以完成实施与验证的路线。

```text
小型 + 条件明确
      ↓
Luna 直接执行并自验

中型 + 边界明确
      ↓
按需 Luna Scout
      ↓
按需 compact Sol 规划
      ↓
Luna 或 Terra 执行
      ↓
只有出现证据触发器时才由 Sol 验证

大型 / 高风险 / 边界模糊
      ↓
按需 Luna Scout
      ↓
Sol 完整规划
      ↓
Terra 主体实现
      ↓
Sol 强制最终验证
```

完成路由后，工作流会自动推进，不会在常规阶段之间反复请求确认。

## 路由概览

分类顺序固定为：**Tier 3 → Tier 1 → Tier 2**。

| 等级 | 精确进入条件 | 默认路线 |
| --- | --- | --- |
| **Tier 1 — 快速** | 预计修改 ≤2 个文件、≤100 行、恰好一个子系统、验收条件明确，并且不存在 Tier 3 风险 | Luna 直接执行 |
| **Tier 2 — 均衡** | Tier 3 不成立，但至少一个 Tier 1 条件不成立 | 条件 Scout → 可选 compact Sol → Luna 或 Terra → 条件 Sol 验证 |
| **Tier 3 — 完整** | 大规模、架构、破坏性、安全敏感、部署、公共 API 或无法界定范围的工作 | 条件 Scout → Sol → Terra → Sol |

未知范围不会进入 Tier 1。编辑前仍然无法界定的不确定性会触发升级。

首次规划或执行前，Skill 会输出一条最终路线：

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna|terra
```

## 六个专用 Agent

| Agent | 模型 / 推理强度 | 权限 | 职责 |
| --- | --- | --- | --- |
| `luna_scout` | Luna / low | 只读 | 仓库发现、长日志压缩、调用链证据 |
| `sol_compact_planner` | Sol / medium | 只读 | Tier 2 有界规划 |
| `sol_planner` | Sol / high | 只读 | 完整规划与高推理验证 |
| `terra_executor` | Terra / medium | workspace-write | 多文件逻辑、集成、重构、调试 |
| `luna_executor` | Luna / medium | workspace-write | 明确的机械、配置、测试和文档工作 |
| `luna_fast_executor` | Luna / low | workspace-write | Tier 1 直接实施与自验 |

发现和执行报告都有输出边界。原始诊断信息保存在任务本地文件中，不会在多个 Agent 之间反复复制。

## 条件发现、规划与验证

### Scout

Tier 1 始终跳过 Scout。Tier 2 和 Tier 3 只有在宽泛发现可能消耗大量高阶上下文时才使用 `luna_scout`，例如跨模块调用链尚不清楚，或诊断材料超过 500 行。

### Tier 2 中的 Sol

实施简报已经明确时，Tier 2 会跳过 Sol。存在真实方案取舍、多个未决根因、兼容性约束、依赖顺序或新的跨文件不变量时，才加入 compact Sol 规划。

### Luna 与 Terra

Luna 处理局部、明确、重复、配置、测试或文档工作。Terra 处理多文件业务逻辑、集成、重构、常规调试，以及仍需较广泛实现推理的工作。

### 验证

Tier 2 只有在出现新证据时才增加 Sol 验证，例如必需检查失败、范围扩大、验收证据不完整、Executor 仍有疑虑，或最终 diff 偏离任务简报。Tier 3 始终以 Sol 验证结束。

## 安装器行为

v1.3 安装器是零运行时依赖的 Node.js CLI。设置了 `CODEX_HOME` 时使用该目录，否则使用 `~/.codex`。

### 安全特性

- 首次写入前预检 Skill、六个 Agent 和全局规则标记。
- 当前文件完全一致时保持原样，时间戳也不会变化。
- 支持迁移与内置 v1.0、v1.1、v1.2 完全一致的 Skill 目录。
- 只迁移可识别的历史 Agent 定义。
- 已安装 Skill 或 Agent 含有未知内容时，在写入前停止。
- 全局规则标记缺失配对或重复时，在写入前停止。
- Skill 目录先暂存，单文件使用同目录原子替换。
- 后续安装步骤发生错误时，恢复本轮操作前的快照。
- 保留全局 `AGENTS.md` 中与本项目无关的内容。
- 不需要 API Key，也不会上传项目仓库内容。

该命令只调整 `CODEX_HOME` 下的 Codex 配置，不会修改命令所在的项目仓库。

### 自定义 Codex 目录

PowerShell：

```powershell
$env:CODEX_HOME = "D:\CodexProfile"
npx -y github:shangzhimingge/sol-luna-handoff
```

Bash / zsh：

```bash
CODEX_HOME="$HOME/codex-profile" \
  npx -y github:shangzhimingge/sol-luna-handoff
```

## PowerShell 手动安装

<details>
<summary>展开手动安装步骤</summary>

```powershell
git clone https://github.com/shangzhimingge/sol-luna-handoff.git

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillTarget = Join-Path $CodexHome "skills\sol-luna-handoff"

if (Test-Path -LiteralPath $SkillTarget) {
    throw "The Skill target already exists: $SkillTarget"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $SkillTarget) -Force | Out-Null
Copy-Item -LiteralPath ".\sol-luna-handoff\skill\sol-luna-handoff" -Destination $SkillTarget -Recurse
& (Join-Path $SkillTarget "scripts\install-agents.ps1")
```

PowerShell 脚本仍然保持幂等，并为 Agent 与全局规则安装部分提供 `-WhatIf`。

</details>

## 自动全局触发

安装器会在 Codex 全局 `AGENTS.md` 中维护一个由标记界定的规则块。创建、修改、修复、重构、审查、测试、配置软件或项目制品，以及编写项目制品文档时，该规则会自动加载 `$sol-luna-handoff`。

普通问答、翻译和与项目制品无关的纯文本写作不在自动触发范围内。

需要时仍可手动调用：

```text
Use $sol-luna-handoff to implement this change.
```

## 仓库结构

```text
.
├── .github/workflows/ci.yml
├── bin/
│   └── cli.mjs
├── package.json
├── README.md
├── README.zh-CN.md
├── LICENSE
├── test/
│   ├── cli.test.mjs
│   ├── package-e2e.test.mjs
│   └── install-agents.tests.ps1
└── skill/
    └── sol-luna-handoff/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── assets/
        │   ├── global-agents.md
        │   └── *.toml
        └── scripts/install-agents.ps1
```

## 环境要求与限制

- npx 安装器需要 Node.js 18 或更高版本。
- npx 使用 GitHub package spec，因此环境中需要 Git。
- Codex 需要支持 Skills 与自定义 Agent。
- 实际模型和 Agent 可用性取决于当前 Codex 套餐与运行环境。
- 路由用于优化资源分配，不承诺所有工作负载都获得相同的成本、速度或质量结果。

## 开发与发行验证

```bash
npm test
npm pack --dry-run
```

`npm test` 会同时运行 CLI 回归测试和打包后 tarball E2E。E2E 会生成真实 npm 包、检查运行时文件清单，再通过 `npm exec` 在隔离的 `CODEX_HOME` 中完成安装、诊断、重复安装和卸载。

Windows 下可单独运行 PowerShell 安装器回归测试：

```powershell
& ".\test\install-agents.tests.ps1"
```

GitHub Actions 会在 Windows、Ubuntu、macOS 上分别使用 Node.js 18、20、22 运行 Node 与打包 E2E，并在独立 Windows 任务中运行 PowerShell 回归套件。

## 参与贡献

欢迎提交 Issue 和 Pull Request，尤其是：

- 真实项目中的路由边界案例；
- Tier 1 或 Tier 3 错误分类；
- 安装兼容性；
- 可复现的速度或额度对比；
- 更多部署环境。

报告路由问题时，建议包含任务类型、预期路线、实际路线、相关证据，以及路线应调整的原因。

## 许可证

MIT © 2026 shangzhimingge

如果这个工作流对你的 Codex 使用体验有帮助，欢迎 ⭐ Star 仓库，让更多 Codex 用户发现它。
