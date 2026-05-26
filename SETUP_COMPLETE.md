# GUI-Anything 环境配置完成 ✅

## 配置信息

- **分支**: `yufan_new_tui_0526`
- **Python 环境**: conda 虚拟环境 `gui-anything` (Python 3.10.20)
- **Bun 版本**: 1.3.14
- **测试结果**: 320/322 通过 (99.4%)

## 已安装组件

### 1. Conda 环境
```bash
环境名称: gui-anything
Python: 3.10.20
位置: ~/miniconda3/envs/gui-anything
```

**已安装的 Python 包** (用于 WeChat 通知服务):
- aiohttp >= 3.9.0
- cryptography >= 41.0.0
- fastapi >= 0.104.0
- uvicorn >= 0.24.0
- pydantic >= 2.5.0
- qrcode >= 7.4.2
- certifi >= 2023.11.17

### 2. Bun JavaScript 运行时
```bash
版本: 1.3.14
位置: ~/.bun/bin/bun
```

### 3. 项目依赖
- @opentui/core & @opentui/react (0.1.72)
- React 19.2.5
- 共计 100 个包

## 快速开始

### 激活环境
```bash
cd ~/GUI-Anything
source ./activate-env.sh
```

### 运行测试
```bash
cd scheme
bun test
```

### 启动 Flow Observer
```bash
# 需要先安装 Zellij 和 Claude CLI
cd scheme
bun run src/main.ts --help

# 或使用 setup 脚本
./scripts/setup.sh
```

## 后续步骤

### 还需要安装的组件 (可选)

1. **Zellij** (终端多路复用器 - 用于双窗格模式)
   ```bash
   # Ubuntu/Debian
   cargo install zellij
   # 或从 https://zellij.dev/documentation/installation.html
   ```

2. **Claude CLI** (Claude Code 命令行工具)
   ```bash
   # 参考: https://docs.anthropic.com/en/docs/claude-code
   ```

### 开发命令

```bash
# 运行测试
cd scheme && bun test

# TypeScript 类型检查
cd scheme && bunx tsc --noEmit

# 导出 HTML 回放
cd scheme && bun run src/main.ts --export-html -o replay.html

# Web Mirror (浏览器实时查看)
cd scheme && bun run src/main.ts --web-mirror --port 3001
```

## Git 配置

- **当前分支**: `yufan_new_tui_0526`
- **远程仓库**: `origin/yufan_new_tui_0526`
- **Git 用户**: yuhan (xiongyufan.xyf@taobao.com)

你在这个分支的所有提交都会关联到你的 GitHub 账号。

## 故障排查

### 如果环境变量丢失
```bash
source ./activate-env.sh
```

### 如果依赖有问题
```bash
cd scheme
rm -rf node_modules bun.lock
bun install
```

### 如果 Python 包有问题
```bash
conda activate gui-anything
pip install -r scheme/src/services/notification/weixin-service/requirements.txt
```

## 文档参考

- [README.md](README.md) - 项目总览
- [docs/development.md](docs/development.md) - 开发文档
- [AGENTS.md](AGENTS.md) - Agent 协作原则

---

配置日期: 2026-05-26
配置人: yuhan
分支: yufan_new_tui_0526
