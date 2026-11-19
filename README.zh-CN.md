# Sol → Luna Handoff

> **2.0 只保留一条工作流：Sol 负责规划与验证，Luna 负责发现与执行。** 所有 Tier 都由 Luna 执行；旧的配置选择参数和 Terra 执行路线已退役。

[English](README.md)

## 安装

```bash
npx -y github:shangzhimingge/sol-luna-handoff
```

该命令会安装 Skill、五个自定义 Agent、全局激活规则，以及唯一的工作流配置：

```json
{
  "schemaVersion": 2,
  "workflow": "sol-luna"
}
```

安装后请新建 Codex 任务，以刷新 Agent 发现缓存。

## 工作流

| Tier | 判定摘要 | 路线 |
| --- | --- | --- |
| **Tier 1** | 不超过 2 个文件、100 行、1 个子系统，验收条件明确，且无 Tier 3 谓词 | `luna_fast_executor` 直接实现并自检 |
| **Tier 2** | Tier 3 不成立，且未完全满足 Tier 1 | 条件式 Luna Scout → 可选 compact Sol 规划 → `luna_executor` → 证据触发的 Sol 验证 |
| **Tier 3** | 大规模、架构、破坏性、安全敏感、部署、公共 API、依赖迁移、并发或范围无界 | 条件式 Luna Scout → Sol 完整规划 → `luna_executor` → Sol 强制验证 |

最终路由固定为：

```text
Route: Tier N - {reason}; Scout: yes|no; Planner: none|compact|full; Executor: luna
```

Tier 阈值、条件式 Scout、修正次数和证据预算继续保持确定性。当 Luna 发现缺少绑定决策或范围超出任务简报/计划时，会在继续编辑前停止，并保留证据交给 Sol 重新规划。

## Agent

| Agent | 模型 / 推理 | 沙箱 | 职责 |
| --- | --- | --- | --- |
| `sol_planner` | `gpt-6.2-sol` / high | read-only | Tier 3 规划与验证；证据触发验证 |
| `sol_compact_planner` | `gpt-6.2-sol` / medium | read-only | 有界 Tier 2 重规划 |
| `luna_scout` | `gpt-6-luna` / low | read-only | 压缩发现证据 |
| `luna_executor` | `gpt-6-luna` / medium | workspace-write | Tier 2、Tier 3 实现 |
| `luna_fast_executor` | `gpt-6-luna` / low | workspace-write | Tier 1 直接实现 |

## 模型选择（2.1）

首选 **`gpt-6.2-sol` / `gpt-6.2-luna`**。如果当前 Codex 模型目录尚未列出支持所需推理档位的 `gpt-6.2-luna`，就使用目录中最新的兼容 Luna（目前为 `gpt-6-luna`）。上表列的是离线默认值。

- **自动（默认）：** 安装和 Skill 预检时读取本地 Codex 模型缓存（最长七天），按数字版本分别选最新 Sol 和 Luna。无需联网或常驻进程。缓存缺失、过期或暂时缺少某个系列时，保留该系列已选模型。
- **查看：** `npx -y github:shangzhimingge/sol-luna-handoff models status` 只读展示已安装、首选和待应用模型。
- **立即刷新：** 将上面命令的 `status` 换成 `refresh`。
- **手动固定：** 用 `models set --sol gpt-6.2-sol --luna gpt-6-luna`，两个 ID 都须出现在新鲜缓存中；用 `models auto` 恢复自动。

配置保存在 `$CODEX_HOME/sol-luna-models.json`。更新保留五个角色的提示词、推理档位和沙箱设置。PowerShell 安装同样需要 Node.js 18+。切换后请新建 Codex 任务；使用 GPT-6.2 Sol 的 Codex CLI 需 0.166.0 或更新版本。

## 命令

```bash
# 安装或升级
npx -y github:shangzhimingge/sol-luna-handoff install

# 只读健康检查
npx -y github:shangzhimingge/sol-luna-handoff doctor

# 删除精确匹配的受管内容
npx -y github:shangzhimingge/sol-luna-handoff uninstall
```

`CODEX_HOME` 用于指定目标 Codex 目录，默认是 `~/.codex`。

## 安全迁移 1.x

安装器会把两种精确的 1.x 受管配置（`adaptive` 或 `sol-luna`）自动迁移到 schema 2。未知 schema、未知值、额外字段、格式损坏、目录碰撞和自定义文件都会在任何写入前终止。

旧的 `terra-executor.toml` 只会在字节精确匹配已发布 LF/CRLF 受管版本时删除。该路径上的自定义文件会原样保留，并在任何写入前阻止安装。Skill、五个 Agent、旧 Agent 删除、全局规则与配置处于同一个回滚事务中；发生故障会恢复先前状态。当前版本重复安装不会写文件，并保留修改时间。

历史 1.x 设计文档保留在 `docs/superpowers` 作为来源记录；[`2026-10-08-pure-sol-luna-design.md`](docs/superpowers/specs/2026-10-08-pure-sol-luna-design.md) 取代其中现行的路由与安装决策。

## 开发验证

```bash
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File ./test/install-agents.tests.ps1
```

## 许可证

MIT
