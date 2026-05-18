#!/usr/bin/env bash
# Wiki 初始化脚本
# 创建标准的 Wiki 目录结构和初始文件

set -euo pipefail

# 默认 Wiki 根目录
WIKI_ROOT="${1:-${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/wiki}"

echo "Initializing Wiki at: $WIKI_ROOT"

# 创建目录结构
mkdir -p "$WIKI_ROOT"/{00-meta/staging,10-errors,20-snippets,30-decisions,40-contexts}

# 创建 00-meta/index.md (如果不存在)
if [[ ! -f "$WIKI_ROOT/00-meta/index.md" ]]; then
cat > "$WIKI_ROOT/00-meta/index.md" << EOF
---
title: "个人知识 Wiki"
created: "$(date +%Y-%m-%d)"
updated: "$(date +%Y-%m-%d)"
---

# 个人知识 Wiki

自动收集和整理开发过程中的问题与解决方案。

## 快速导航

### 按类型浏览
- [[10-errors/index|错误模式]] — 系统报错与解决方案
- [[20-snippets/index|代码片段]] — 可复用的命令与配置
- [[30-decisions/index|架构决策]] — 技术决策记录 (ADR)
- [[40-contexts/index|环境上下文]] — 项目/环境特定信息

### 最近更新
<!-- 由脚本自动生成 -->

### 搜索
使用 `wiki-search.sh` 或 Flow UI 自动检索。

---

**统计**: 0 个错误 | 0 个片段 | 0 个决策 | 0 个上下文

---

## 使用说明

### 自动收集
Flow 会话结束后，系统自动提取知识到本 Wiki。

### 手动审核
检查 `00-meta/staging/` 目录中的待审核条目，确认后移动到正确分类目录。

### 与 Flow 集成
在 Flow UI 中输入问题时，Status Line 会自动提示相似的 Wiki 条目。
EOF
fi

# 创建模板文件 (如果不存在)
if [[ ! -f "$WIKI_ROOT/00-meta/template-entry.md" ]]; then
cat > "$WIKI_ROOT/00-meta/template-entry.md" << 'EOF'
---
id: "{AUTO_GENERATED}"
slug: "{kebab-case-title}"
title: "{Title}"
created: "{YYYY-MM-DDTHH:mm:ss+08:00}"
updated: "{YYYY-MM-DDTHH:mm:ss+08:00}"
version: 1
type: "{error|snippet|decision|context}"
category: "{category}"
tags: []
related: []
aliases: []
source:
  session_id: "{optional-session-id}"
  exploration_id: "{optional-exploration-id}"
status: "draft"
---

# {Title}

## 问题/摘要
{2-3 sentences describing the issue or knowledge point}

## 上下文
- 环境: {e.g., macOS 15, Docker, Node 20}
- 项目: {optional project reference}

## 解决方案/内容
{Main content: commands, config, explanation}

## 参考
- [[related-entry]]
- [External link](url)

## 备注
<!-- Additional notes -->
EOF
fi

# 创建 staging README (如果不存在)
if [[ ! -f "$WIKI_ROOT/00-meta/staging/README.md" ]]; then
cat > "$WIKI_ROOT/00-meta/staging/README.md" << 'EOF'
# Staging Area

此目录存放自动提取但尚未审核的 Wiki 条目。

## 审核流程

1. 查看此目录中的 `.md` 文件
2. 编辑确认内容准确性
3. 移动到正确分类目录
4. 更新 frontmatter 中的 `status: "published"`

## 自动清理
长期未审核的条目（超过 30 天）会被自动归档。
EOF
fi

# 创建分类目录的 index.md
for category in 10-errors 20-snippets 30-decisions 40-contexts; do
  name=""
  prefix=""
  case "$category" in
    10-errors) name="错误模式"; prefix="E" ;;
    20-snippets) name="代码片段"; prefix="S" ;;
    30-decisions) name="架构决策"; prefix="D" ;;
    40-contexts) name="环境上下文"; prefix="C" ;;
  esac

  if [[ ! -f "$WIKI_ROOT/$category/index.md" ]]; then
    cat > "$WIKI_ROOT/$category/index.md" << EOF
---
title: "$name"
category: "${category#*-}"
created: "$(date +%Y-%m-%d)"
---

# $name ($category)

## 命名规范

文件名: \`${prefix}{3位数字}-{kebab-case}.md\`

## 条目列表

<!-- 由脚本自动生成 -->

_暂无条目_

---

[[00-meta/index|返回首页]]
EOF
  fi
done

echo "✅ Wiki 初始化完成"
echo ""
echo "目录结构:"
tree -L 2 "$WIKI_ROOT" 2>/dev/null || find "$WIKI_ROOT" -maxdepth 2 -type d | sed 's|[^/]*/|  |g'
