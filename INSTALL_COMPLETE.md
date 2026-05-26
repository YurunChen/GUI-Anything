# GUI-Anything 完整安装完成 ✅

安装日期：2026-05-26  
分支：yufan_new_tui_0526  
安装者：yuhan

---

## 安装组件清单

### ✅ 核心运行时

| 组件 | 版本 | 安装位置 |
|------|------|----------|
| **Python** | 3.10.20 | conda env: gui-anything |
| **Node.js** | 20.20.1 | conda env: gui-anything |
| **Bun** | 1.3.14 | ~/.bun/bin/bun |
| **Claude CLI** | 2.1.150 | ~/.local/bin/claude |
| **Zellij** | 0.41.2 | ~/.local/bin/zellij |

### ✅ Python 包 (WeChat 通知服务)

- aiohttp >= 3.9.0
- cryptography >= 41.0.0
- fastapi >= 0.104.0
- uvicorn >= 0.24.0
- pydantic >= 2.5.0
- qrcode >= 7.4.2
- certifi >= 2023.11.17

### ✅ Bun 包 (100 packages)

- @opentui/core & @opentui/react (0.1.72)
- React 19.2.5
- TypeScript & 类型定义

### ✅ 测试状态

- **总测试数**: 322
- **通过**: 322 (100%)
- **失败**: 0
- **断言**: 699

---

## 环境变量配置

所有工具路径已添加到 `~/.bashrc`：

```bash
# Conda
# 通过 conda init 自动配置

# Bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Zellij & Claude CLI
export PATH="$HOME/.local/bin:$PATH"

# npm global (用户级)
export PATH="$HOME/.npm-global/bin:$PATH"
```

---

## 快速开始

### 1. 激活环境

每次打开新终端时：

```bash
cd ~/GUI-Anything
source ./activate-env.sh
```

或者手动：

```bash
source ~/.bashrc
conda activate gui-anything
```

### 2. 环境检查

```bash
node cli/ga.mjs doctor
```

**期望输出**：
```
ga doctor
---------
OK    Claude CLI - available in PATH
WARN  Claude auth readiness - credentials file not found
      fix: Run `claude` once and complete login before `ga flow`.
OK    Bun runtime - available in PATH
OK    Zellij terminal multiplexer - available in PATH
OK    Writable wiki directory - /home/yufan/GUI-Anything/wiki
OK    Session index (optional) - not created yet (run flow once)

Environment is ready.
```

### 3. Claude CLI 登录（首次使用）

在使用 `ga flow` 之前，需要先登录 Claude：

```bash
claude
# 按提示完成登录
```

### 4. 启动 Flow Observer

```bash
# 新会话
node cli/ga.mjs flow

# 继续上次会话
node cli/ga.mjs flow --continue

# 恢复特定会话
node cli/ga.mjs flow --resume <session-id>

# 指定模型
node cli/ga.mjs flow --model sonnet "your prompt"
```

---

## 功能测试

### 测试项目代码

```bash
cd scheme
bun test
```

### 导出 HTML 回放

```bash
cd scheme
bun run src/main.ts --export-html -o replay.html
```

### Web Mirror（浏览器实时查看）

```bash
cd scheme
FLOW_PROJECT_DIR=/home/yufan/GUI-Anything \
  bun run src/main.ts --web-mirror --port 3001
```

### 知识图谱

```bash
cd scheme
bun run src/main.ts --knowledge-graph -o graph.html
```

---

## 目录结构

```
~/GUI-Anything/
├── cli/                    # ga 命令行工具
├── scheme/                 # Observer 应用 (Bun + OpenTUI)
├── scripts/                # 辅助脚本
├── skills/                 # Claude 技能
│   └── llm-wiki/          # Wiki 管理技能
├── wiki/                   # 本地知识库 (gitignored)
├── docs/                   # 文档
├── activate-env.sh         # 环境激活脚本
├── INSTALL_COMPLETE.md     # 本文档
└── SETUP_COMPLETE.md       # 基础配置文档
```

---

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `source ./activate-env.sh` | 激活完整环境 |
| `node cli/ga.mjs doctor` | 环境健康检查 |
| `node cli/ga.mjs flow` | 启动双窗格 Flow |
| `node cli/ga.mjs flow -c` | 继续上次会话 |
| `bun test` | 运行测试 (在 scheme/) |
| `bunx tsc --noEmit` | TypeScript 检查 |
| `./scripts/setup.sh` | 重新运行 setup |

---

## 故障排查

### 命令找不到

确保已激活环境：
```bash
source ./activate-env.sh
```

或者重新加载 shell 配置：
```bash
source ~/.bashrc
conda activate gui-anything
```

### Bun 命令不可用

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
bun --version
```

### Claude CLI 不可用

```bash
export PATH="$HOME/.local/bin:$PATH"
claude --version
```

### Node.js 版本错误

确保使用 conda 环境中的 Node.js：
```bash
conda activate gui-anything
node --version  # 应该是 v20.20.1
```

### 测试失败

清理并重新安装依赖：
```bash
cd scheme
rm -rf node_modules bun.lock
bun install
bun test
```

---

## 下一步

1. **登录 Claude CLI**：`claude` (首次使用必须)
2. **测试 Flow**：`node cli/ga.mjs flow`
3. **阅读文档**：
   - [docs/development.md](docs/development.md) - 架构与开发指南
   - [README.md](README.md) - 功能总览
   - [AGENTS.md](AGENTS.md) - Agent 协作原则

---

## 技术支持

- 项目问题：https://github.com/YurunChen/GUI-Anything/issues
- Claude Code 文档：https://docs.anthropic.com/en/docs/claude-code
- Zellij 文档：https://zellij.dev/documentation/
- Bun 文档：https://bun.sh/docs

---

**🎉 安装完成！开始你的 GUI-Anything 之旅吧！**
