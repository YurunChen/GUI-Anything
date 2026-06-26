#!/bin/bash
# 切换 Flow Observer 主题（持久化到 ~/.flow-observer/theme.json）
# 启动时由 themeManager.getDefaultTheme() 读取，无需 source 即可生效。

THEME=$1

ALL_THEMES=(
  # 默认透明
  transparent
  # 深色
  tokyo-night nord catppuccin dracula gruvbox solarized one-dark
  # 浅色
  solarized-light gruvbox-light catppuccin-latte github-light
  # 彩色
  monokai synthwave ocean
  # 莫兰迪 — light 版（浅色淡雅）
  sakura-pink-light sage-green-light lavender-light misty-blue-light
  milk-tea-light    lotus-pink-light matcha-light    peach-light
  # 莫兰迪 — dark 版（中深柔和）
  sakura-pink-dark  sage-green-dark  lavender-dark   misty-blue-dark
  milk-tea-dark     lotus-pink-dark  matcha-dark     peach-dark
  # 旧别名（向后兼容，等价于对应 -light 版）
  sakura-pink sage-green lavender misty-blue milk-tea lotus-pink matcha peach
)

print_usage() {
  echo "Usage: ./scripts/set-theme.sh <theme-name>"
  echo ""
  echo "Available themes:"
  echo "  ── Default ──────────────────────────"
  echo "  transparent     透明背景（默认）"
  echo "  ── Dark ─────────────────────────────"
  echo "  tokyo-night     深蓝灰"
  echo "  nord            冷色系蓝灰"
  echo "  catppuccin      温暖紫粉"
  echo "  dracula         经典紫色"
  echo "  gruvbox         复古暖色"
  echo "  solarized       低对比度护眼"
  echo "  one-dark        Atom 经典"
  echo "  ── Light ────────────────────────────"
  echo "  solarized-light 米黄护眼"
  echo "  gruvbox-light   暖米黄"
  echo "  catppuccin-latte温暖浅色"
  echo "  github-light    GitHub 纯白"
  echo "  ── Vivid ────────────────────────────"
  echo "  monokai         经典鲜艳"
  echo "  synthwave       赛博朋克"
  echo "  ocean           海洋蓝"
  echo "  ── Morandi · Light (浅色淡雅) ───────"
  echo "  sakura-pink-light  樱花粉"
  echo "  sage-green-light   雾霾青绿"
  echo "  lavender-light     薰衣草"
  echo "  misty-blue-light   雾霾蓝"
  echo "  milk-tea-light     焦糖奶茶"
  echo "  lotus-pink-light   藕荷色"
  echo "  matcha-light       抹茶绿"
  echo "  peach-light        蜜桃橙"
  echo "  ── Morandi · Dark (中深柔和) ────────"
  echo "  sakura-pink-dark   豆沙粉"
  echo "  sage-green-dark    深雾绿"
  echo "  lavender-dark      暮紫"
  echo "  misty-blue-dark    深雾蓝"
  echo "  milk-tea-dark      深咖啡"
  echo "  lotus-pink-dark    深藕"
  echo "  matcha-dark        深抹茶"
  echo "  peach-dark         深桃"
  echo ""
  echo "Example: ./scripts/set-theme.sh dracula"
}

if [ -z "$THEME" ]; then
  print_usage
  exit 1
fi

# 校验是否在白名单中
match=0
for valid in "${ALL_THEMES[@]}"; do
  if [ "$valid" = "$THEME" ]; then
    match=1
    break
  fi
done

if [ "$match" -eq 0 ]; then
  echo "Error: Unknown theme '$THEME'"
  echo ""
  print_usage
  exit 1
fi

CONFIG_DIR="$HOME/.flow-observer"
CONFIG_FILE="$CONFIG_DIR/theme.json"
mkdir -p "$CONFIG_DIR"

# 写入与 theme-config.ts 一致的格式：{ currentTheme, lastUpdated }
NOW_MS=$(($(date +%s) * 1000))
cat > "$CONFIG_FILE" <<EOF
{
  "currentTheme": "$THEME",
  "lastUpdated": $NOW_MS
}
EOF

echo "✅ Theme set to: $THEME"
echo "   Config written: $CONFIG_FILE"
echo "   重启 Observer 即生效（也可在 TUI 内按 [j]/[k] 热切换）"
