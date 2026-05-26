# Flow Observer 主题系统

Flow Observer 支持 **32 种**配色主题：推荐 **Apple System**（light/dark）+ 7 深色 + 4 浅色 + 3 彩色 + 16 莫兰迪（8 hue × light/dark）。

## 推荐默认

### **Apple System · Dark**（默认）
macOS/iOS 语义色，低饱和 chrome + 系统蓝 accent
```bash
FLOW_THEME=apple-system-dark
```

### **Apple System · Light**
```bash
FLOW_THEME=apple-system-light
```

按 `[` `]` 在全部 32 种主题间循环；按 `J` 仅在莫兰迪 16 主题内循环（同 hue 的 light/dark 相邻）。

## 语义 Token

组件应优先使用 `semantic.label.*` / `semantic.fill.*` / `semantic.tint`（见 `scheme/src/app/ui/theme.ts`），而非直接使用高饱和 `colors.status.*`。

## 深色主题 🌙

### 1. **Tokyo Night**
深蓝灰色主题，低对比度，适合长时间使用
```bash
FLOW_THEME=tokyo-night
```

### 2. **Nord** ❄️
冷色系蓝灰主题，清爽简洁
```bash
FLOW_THEME=nord
```

### 3. **Catppuccin** ⭐
温暖的紫粉色主题，现代感十足，高对比度
```bash
FLOW_THEME=catppuccin
```

### 4. **Dracula** 🧛
经典紫色主题，鲜艳活泼
```bash
FLOW_THEME=dracula
```

### 5. **Gruvbox** 🔥
复古暖色主题，舒适的黄褐色调
```bash
FLOW_THEME=gruvbox
```

### 6. **Solarized** 
经典低对比度深色主题，护眼舒适
```bash
FLOW_THEME=solarized
```

### 7. **One Dark** 
Atom 编辑器经典主题，平衡的配色
```bash
FLOW_THEME=one-dark
```

## 浅色主题 ☀️

### 8. **Solarized Light** 
经典米黄色浅色主题，温暖护眼
```bash
FLOW_THEME=solarized-light
```

### 9. **Gruvbox Light** 🔥
复古暖色浅色主题，舒适的米黄色调
```bash
FLOW_THEME=gruvbox-light
```

### 10. **Catppuccin Latte** ⭐
温暖的浅色主题，现代感十足
```bash
FLOW_THEME=catppuccin-latte
```

### 11. **GitHub Light** 
GitHub 风格纯白主题，清爽简洁
```bash
FLOW_THEME=github-light
```

## 彩色主题 🌈

### 12. **Monokai** 
经典鲜艳主题，高对比度
```bash
FLOW_THEME=monokai
```

### 13. **Synthwave** 💜
赛博朋克风格，霓虹粉紫色
```bash
FLOW_THEME=synthwave
```

### 14. **Ocean** 🌊
海洋蓝主题，深邃清爽
```bash
FLOW_THEME=ocean
```

## 莫兰迪色系 🌸（柔和但有辨识度）

> 每个 hue 都提供 **light**（浅色淡雅，深色文字）和 **dark**（中深柔和，浅色文字）两个版本。
> 在 TUI 内按 `[` `]` 切换主题；莫兰迪系列用 `J` 在同 hue 的 light/dark 对之间快速切换。
>
> 旧的不带 `-light/-dark` 后缀的名字（例如 `sakura-pink`）仍然能用，自动等价于对应的 `-light` 版本。

### 15-16. 🌸 樱花粉  Sakura Pink
```bash
FLOW_THEME=sakura-pink-light    # 浅色淡雅
FLOW_THEME=sakura-pink-dark     # 中深豆沙粉
```

### 17-18. 🌿 雾霾青绿  Sage Green
```bash
FLOW_THEME=sage-green-light
FLOW_THEME=sage-green-dark
```

### 19-20. 💜 薰衣草  Lavender
```bash
FLOW_THEME=lavender-light
FLOW_THEME=lavender-dark
```

### 21-22. 🌊 雾霾蓝  Misty Blue
```bash
FLOW_THEME=misty-blue-light
FLOW_THEME=misty-blue-dark
```

### 23-24. 🍂 焦糖奶茶  Milk Tea
```bash
FLOW_THEME=milk-tea-light
FLOW_THEME=milk-tea-dark
```

### 25-26. 🌸 藕荷色  Lotus Pink
```bash
FLOW_THEME=lotus-pink-light
FLOW_THEME=lotus-pink-dark
```

### 27-28. 🍵 抹茶绿  Matcha
```bash
FLOW_THEME=matcha-light
FLOW_THEME=matcha-dark
```

### 29-30. 🍑 蜜桃橙  Peach
```bash
FLOW_THEME=peach-light
FLOW_THEME=peach-dark
```

## 如何切换主题

### 方法一：临时切换（仅当前会话）

在 Zellij 右栏（observer pane）重启时指定主题，或整会话用主题变量启动：

```bash
# 推荐：启动 flow 时带上主题
FLOW_THEME=catppuccin ./scripts/flow-run.sh

# 或在 observer 窗格内 Ctrl-C 后（仍在 scheme 目录）
FLOW_THEME=catppuccin bun run src/main.ts --live
```

日常入口为 `ga flow`（`scripts/flow-run.sh`），不再使用 tmux `flow-main` 分屏。

### 方法二：永久设置

将主题环境变量添加到你的 shell 配置文件：

**Bash 用户** (`~/.bashrc`):
```bash
export FLOW_THEME=catppuccin
```

**Zsh 用户** (`~/.zshrc`):
```bash
export FLOW_THEME=gruvbox
```

然后重新加载配置：
```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### 方法三：使用快捷脚本

```bash
# 查看所有可用主题
./scripts/demo-themes.sh

# 设置主题（写入 ~/.flow-observer/theme.json，重启 Observer 即生效）
./scripts/set-theme.sh catppuccin
```

### 方法四：在 TUI 内热切换（无需重启）

在 Observer 运行时直接按键：

| 按键 | 动作 |
| --- | --- |
| `[` | 上一个主题 |
| `]` | 下一个主题（32 种全循环） |
| `J` | 仅在莫兰迪 16 主题内循环（同色调 light/dark 相邻） |

切换是即时的，并会自动写入 `~/.flow-observer/theme.json` 持久化。

## 主题预览

每个主题都包含以下元素的配色：
- **背景色**：primary, secondary, tertiary, highlight
- **前景色**：primary, secondary, muted, dim
- **状态色**：success, warning, error, info
- **强调色**：primary, secondary, tertiary
- **边框色**：normal, active, muted
- **Wiki 卡片**：专属的知识卡片配色

## 推荐主题

### 深色环境
- **长时间使用**：Tokyo Night、Nord、Solarized
- **高对比度**：Catppuccin、Dracula、Monokai
- **复古风格**：Gruvbox
- **现代简洁**：One Dark、Nord、Ocean

### 浅色环境 ☀️
- **护眼舒适**：Solarized Light、Gruvbox Light
- **清爽简洁**：GitHub Light、Catppuccin Latte
- **长时间使用**：Gruvbox Light、Catppuccin Latte

### 特殊风格
- **赛博朋克爱好者**：Synthwave 💜
- **GitHub 用户**：GitHub Light、Ocean
- **经典编辑器**：Monokai、One Dark

## 自定义主题

如果你想创建自己的主题，可以编辑 `scheme/src/app/ui/themes/index.ts` 文件，添加新的配色方案。

主题定义示例：
```typescript
export const myTheme: ColorScheme = {
  bg: {
    primary: '#your-color',
    secondary: '#your-color',
    // ... 更多配色
  },
  // ... 完整配色定义
};
```

然后在 `themes` 对象中注册你的主题：
```typescript
export const themes: Record<ThemeName, ColorScheme> = {
  // ... 其他主题
  'my-theme': myTheme,
};
```

## 问题反馈

如果你有主题建议或发现配色问题，欢迎提 Issue 或 PR！
