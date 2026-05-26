#!/bin/bash
# Activate GUI-Anything development environment
# Usage: source ./activate-env.sh

# Activate conda environment
if [ -f "$HOME/miniconda3/bin/activate" ]; then
  source $HOME/miniconda3/bin/activate gui-anything
else
  echo "⚠️  Conda not found, skipping conda activation"
fi

# Add all tools to PATH
export BUN_INSTALL="$HOME/.bun"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$BUN_INSTALL/bin:$PATH"

# Verify installations
if command -v python &> /dev/null; then
  PYTHON_VER=$(python --version 2>&1)
else
  PYTHON_VER="not found"
fi

if command -v node &> /dev/null; then
  NODE_VER=$(node --version 2>&1)
else
  NODE_VER="not found"
fi

if command -v bun &> /dev/null; then
  BUN_VER=$(bun --version 2>&1)
else
  BUN_VER="not found"
fi

if command -v claude &> /dev/null; then
  CLAUDE_VER=$(claude --version 2>&1 | head -1)
else
  CLAUDE_VER="not found"
fi

if command -v zellij &> /dev/null; then
  ZELLIJ_VER=$(zellij --version 2>&1)
else
  ZELLIJ_VER="not found"
fi

echo "✅ GUI-Anything environment activated!"
echo "📦 Python: $PYTHON_VER"
echo "📦 Node.js: $NODE_VER"
echo "🚀 Bun: $BUN_VER"
echo "🤖 Claude CLI: $CLAUDE_VER"
echo "🪟 Zellij: $ZELLIJ_VER"
echo ""
echo "Quick commands:"
echo "  node cli/ga.mjs doctor             # Check environment"
echo "  node cli/ga.mjs flow               # Start dual-pane flow"
echo "  cd scheme && bun test              # Run tests"
echo "  ./scripts/setup.sh                 # Run setup script"
