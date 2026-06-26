# Contributing to GUI-Anything

感谢考虑贡献！本文说明如何**搭建环境、构建验证、提交 PR**。架构细节见 [docs/development.md](docs/development.md)，Agent 红线见 [AGENTS.md](AGENTS.md)。

<p align="right">
  <a href="README.md">English README</a> · <a href="README_CN.md">简体中文 README</a>
</p>

---

## 你需要什么

| 依赖 | 用途 | 安装 |
|------|------|------|
| [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) | 左栏 Agent（手测 `ga flow`） | 官方文档 |
| [Bun](https://bun.sh) | 运行 / 测试 `scheme/` | `curl -fsSL https://bun.sh/install \| bash` |
| [Zellij](https://zellij.dev) | 双栏 launcher | `brew install zellij`（macOS） |
| Node.js ≥ 20 | `ga` CLI 与 npm 包测试 | 官方 LTS |
| Git | 版本管理 | 系统包管理器 |

可选：已登录 Claude Code、可访问 `~/.claude/projects/.../*.jsonl` 的本地 session（用于 live 手测）。

---

## 首次构建（5 分钟）

```bash
git clone https://github.com/YurunChen/GUI-Anything.git
cd GUI-Anything

./scripts/setup.sh          # Bun 依赖、Zellij 检查、llm-wiki skill symlink
cd scheme && bun install    # setup 已跑过可跳过

# 验证
cd scheme && bun test && bunx tsc --noEmit
cd .. && ga doctor          # 需先把 repo 加入 PATH，或 npm link / 全局安装
```

### 让 `ga` 指向本地代码

开发时任选其一：

```bash
# 方式 A：npm link（推荐）
npm link
ga doctor

# 方式 B：直接用 node 跑 CLI
node ./cli/ga.mjs doctor
node ./cli/ga.mjs flow
```

### 仅调试右栏 Observer

不启动 Zellij 双栏时，可单独跑 observer：

```bash
cd scheme
FLOW_PROJECT_DIR=/path/to/your/repo \
FLOW_SESSION_ID=<claude-session-uuid> \
bun run start:live
```

`FLOW_SESSION_ID` 来自 `~/.claude/projects/` 下对应 JSONL 文件名（UUID 部分）。

---

## 日常开发循环

```
1. 从 main 拉最新代码，开 feature 分支
2. 读需求 → 确定改动层（data / services / hooks / ui）
3. 改 scheme/src/（必要时 scripts/、skills/、cli/）
4. 跑验证命令（见下节）
5. 按需更新 docs/ · README · AGENTS.md
6. 开 PR，填写行为变化与测试说明
```

### 改动落在哪一层？

| 你要做… | 先改 / 主要看… |
|---------|----------------|
| 新持久化字段、文件 IO | `scheme/src/data/` |
| 摘要、wiki、session 策略 | `scheme/src/services/` |
| React 编排、轮询 | `scheme/src/app/observer/hooks/` |
| 展示、快捷键、主题 | `scheme/src/app/ui/` |
| 跨层数据结构 | `scheme/src/data/protocol/` **先改类型** |
| 启动参数、env 注入 | `scripts/flow-run.sh` |
| 对外 CLI | `cli/ga.mjs` |

**不要**：在 UI 组件里直接 `fs`；在多个模块复制 session binding / resume 分支。细则见 [AGENTS.md §4](AGENTS.md)。

---

## 提交 PR 前的验证

在 PR 描述里说明你跑了哪些检查。最低要求：

```bash
# 1. scheme 单元测试 + 类型检查（必跑）
cd scheme && bun test && bunx tsc --noEmit

# 2. 根目录 CLI 测试（改了 cli/ 时必跑）
cd .. && npm run verify

# 3. 环境自检（行为变更涉及 flow 时建议跑）
ga doctor
```

### 手测清单（UI / session / wiki 相关）

- [ ] `ga flow` 能启动双栏，右栏快捷键可用（先点击右栏聚焦）
- [ ] 改动涉及 resume：`ga flow -c` / `ga flow -r <id>` 行为符合预期
- [ ] 改动涉及 wiki：KNOWLEDGE 卡片与 write badge 不混淆
- [ ] 新 `FLOW_*` 已写入 `./scripts/flow-run.sh --help` 与 [docs/development.md §5.2](docs/development.md)

### Definition of Done

- [ ] 行为变更有测试，或 PR 中说明为何不测
- [ ] `bun test` + `tsc --noEmit` 通过
- [ ] 未违反 [AGENTS.md](AGENTS.md) 架构红线
- [ ] 相关 `docs/` / `README` 已同步（或说明无需更新）
- [ ] **未提交** `wiki/`、`.flow-runtime/`、本地 log、密钥

---

## 开 Pull Request

### 1. 分支

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description   # 或 fix/、docs/
```

命名建议：`feat/wiki-retrieval-cache`、`fix/resume-banner-copy`、`docs/flow-env-table`。

### 2. Commit

遵循仓库现有风格（简短、动词开头、说明「为什么」）：

```
feat: add calm mode toggle to exploration cards
fix: prevent duplicate summary regen on continue bind
docs: document FLOW_LOG_MODULES in development guide
test: cover session-runtime-policy replay branch
```

- **一次 PR 只做一件事** — 不要夹带无关 refactor
- **小步可验证** — Reviewer 能独立理解 diff 意图

### 3. PR 描述模板

复制到 PR body：

```markdown
## Summary
<!-- 1–3 句：解决什么问题、用户可见变化 -->

## Changes
<!-- 关键文件 / 模块；若动到策略单点请注明 -->

## Test plan
- [ ] `cd scheme && bun test && bunx tsc --noEmit`
- [ ] `npm run verify`（若改了 cli/）
- [ ] 手测：<!-- ga flow / -c / -r / 具体场景 -->

## Docs
- [ ] 已更新 docs/ / README / AGENTS.md
- [ ] 无需文档（原因：<!-- 例如纯内部 refactor，无行为变化 -->）

## Risks
<!-- 可选：回归点、未覆盖 edge case -->
```

### 4. Review 时我们关注什么

| 维度 | 说明 |
|------|------|
| **依赖方向** | UI 是否误 import services/repository |
| **策略单点** | binding、resume、wiki 门禁是否重复实现 |
| **协议先行** | 行为变更是否先改 `data/protocol/` |
| **测试** | 关键分支是否有覆盖 |
| **文档** | 用户可见变化是否同步 README / docs |

---

## 不要提交的内容

| 路径 / 内容 | 原因 |
|-------------|------|
| `wiki/` | 本地知识库，已在 `.gitignore` |
| `.flow-runtime/` | Zellij layout 缓存 |
| `logs/`、`*.log` | 本地调试输出 |
| `.env`、token、Webhook URL | 密钥 |
| 大规模格式化 / 无关文件移动 | 增加 Review 噪音 |

若误加入，提交前：`git restore --staged <path>` 并确认 `.gitignore`。

---

## 文档该写在哪

| 改了… | 至少更新… |
|-------|-----------|
| 对外命令、`ga flow` 行为 | `README.md` · `README_CN.md` |
| `FLOW_*` / session 模式 | [docs/development.md §5](docs/development.md) · `AGENTS.md` |
| Wiki 检索 / 策展 | [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md) |
| UI import / chrome | [docs/data-governance/ui-layer-rules.md](docs/data-governance/ui-layer-rules.md) |
| 新 wiki CLI flag | [scripts/wiki/README.md](scripts/wiki/README.md) |
| Agent skill 行为 | `skills/<name>/SKILL.md` |

原则：**设计细节进 `docs/`，根目录 README 保持短。**

---

## 常见问题

<details>
<summary><b><code>ga: command not found</code></b></summary>

在仓库根目录执行 `npm link`，或使用 `node ./cli/ga.mjs`。
</details>

<details>
<summary><b><code>zellij: command not found</code></b></summary>

安装 Zellij 后重跑 `ga doctor`。macOS：`brew install zellij`。
</details>

<details>
<summary><b>Observer 快捷键无效</b></summary>

在 Zellij 中**先点击右栏**使其获得焦点，再按 `g` / `i` / `?` 等。
</details>

<details>
<summary><b><code>bun test</code> 失败</b></summary>

确认在 `scheme/` 目录下运行；依赖问题可试 `rm -rf node_modules && bun install`。
</details>

<details>
<summary><b>残留 Zellij session / 孤儿进程</b></summary>

```bash
./scripts/flow-run.sh --cleanup
```
</details>

更多运维说明：[docs/development.md §5.4](docs/development.md) · [README Troubleshooting](README.md#troubleshooting)

---

## 发布（维护者）

Contributor 通常不需要发包。维护者发布 `gui-anything` npm 包时见 [docs/release-checklist.md](docs/release-checklist.md)。

---

## 获取帮助

- **Bug / 功能请求**：GitHub Issues
- **架构与扩展**： [docs/development.md](docs/development.md)
- **Wiki 链路**： [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md)

欢迎 PR。小修复、测试、文档改进同样有价值。
