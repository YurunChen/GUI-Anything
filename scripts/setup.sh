#!/usr/bin/env bash
# One-click setup for GUI-Anything Flow Observer
# Usage: ./scripts/setup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEME_DIR="$ROOT_DIR/scheme"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

setup_zellij_env() {
  log_info "Checking Zellij installation (optional, current-terminal split layout)..."
  if command_exists zellij; then
    local zellij_version
    zellij_version="$(zellij --version 2>/dev/null || true)"
    log_success "Zellij found: ${zellij_version:-installed}"
    return 0
  fi

  log_warn "Zellij not found."
  if [[ "$OSTYPE" == "darwin"* ]] && command_exists brew; then
    log_info "Install with:"
    log_info "  brew install zellij"
  else
    log_info "Install Zellij: https://zellij.dev/documentation/installation.html"
  fi
}

# Install tmux
install_tmux() {
  log_info "Checking tmux installation..."

  if command_exists tmux; then
    TMUX_VERSION=$(tmux -V | grep -oE '[0-9]+\.[0-9]+' | head -1)
    log_success "tmux found: version $TMUX_VERSION"
    return 0
  fi

  log_warn "tmux not found. Attempting to install..."

  # Detect OS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command_exists brew; then
      log_info "Installing tmux via Homebrew..."
      brew install tmux
    elif command_exists port; then
      log_info "Installing tmux via MacPorts..."
      sudo port install tmux
    else
      log_error "Neither Homebrew nor MacPorts found."
      log_info "Please install tmux manually: https://github.com/tmux/tmux/wiki/Installing"
      exit 1
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command_exists apt-get; then
      log_info "Installing tmux via apt..."
      sudo apt-get update && sudo apt-get install -y tmux
    elif command_exists dnf; then
      log_info "Installing tmux via dnf..."
      sudo dnf install -y tmux
    elif command_exists yum; then
      log_info "Installing tmux via yum..."
      sudo yum install -y tmux
    elif command_exists pacman; then
      log_info "Installing tmux via pacman..."
      sudo pacman -S tmux
    else
      log_error "No supported package manager found."
      log_info "Please install tmux manually: https://github.com/tmux/tmux/wiki/Installing"
      exit 1
    fi
  else
    log_error "Unsupported OS: $OSTYPE"
    log_info "Please install tmux manually: https://github.com/tmux/tmux/wiki/Installing"
    exit 1
  fi

  # Verify installation
  if command_exists tmux; then
    TMUX_VERSION=$(tmux -V | grep -oE '[0-9]+\.[0-9]+' | head -1)
    log_success "tmux installed: version $TMUX_VERSION"
  else
    log_error "tmux installation failed"
    exit 1
  fi
}

# Install Bun
install_bun() {
  log_info "Checking Bun installation..."

  if command_exists bun; then
    BUN_VERSION=$(bun --version)
    log_success "Bun found: version $BUN_VERSION"
    return 0
  fi

  log_warn "Bun not found. Installing..."

  log_info "Installing Bun via official installer..."
  curl -fsSL https://bun.sh/install | bash

  # Add to PATH for current session
  if [[ -f "$HOME/.bashrc" ]]; then
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"
  fi

  # Verify installation
  if command_exists bun; then
    BUN_VERSION=$(bun --version)
    log_success "Bun installed: version $BUN_VERSION"
  else
    log_error "Bun installation failed"
    log_info "Please add Bun to your PATH manually:"
    log_info "  export BUN_INSTALL=\"\$HOME/.bun\""
    log_info "  export PATH=\"\$BUN_INSTALL/bin:\$PATH\""
    exit 1
  fi
}

# Install project dependencies
install_project_deps() {
  log_info "Installing project dependencies..."

  cd "$SCHEME_DIR"

  if [[ ! -f "package.json" ]]; then
    log_error "package.json not found in $SCHEME_DIR"
    log_info "Please ensure the repository is cloned correctly."
    exit 1
  fi

  # Clean install if node_modules exists but may be corrupted
  if [[ -d "node_modules" ]]; then
    log_warn "Existing node_modules found. Cleaning..."
    rm -rf node_modules bun.lock
  fi

  log_info "Running bun install..."
  bun install

  # Verify OpenTUI is installed
  if [[ ! -d "node_modules/@opentui" ]]; then
    log_error "Dependency installation may have failed"
    log_info "Trying one more time..."
    bun install
  fi

  log_success "Dependencies installed successfully"
}

# Set executable permissions
set_permissions() {
  log_info "Setting executable permissions..."

  if [[ -f "$ROOT_DIR/scripts/flow-run.sh" ]]; then
    chmod +x "$ROOT_DIR/scripts/flow-run.sh"
    log_success "flow-run.sh is executable"
  fi

  if [[ -f "$ROOT_DIR/scripts/setup.sh" ]]; then
    chmod +x "$ROOT_DIR/scripts/setup.sh"
  fi

  if [[ -f "$ROOT_DIR/scripts/flow-run-zellij.sh" ]]; then
    chmod +x "$ROOT_DIR/scripts/flow-run-zellij.sh"
    log_success "flow-run-zellij.sh is executable"
  fi
}

# Verify installation
verify_installation() {
  log_info "Verifying installation..."

  cd "$SCHEME_DIR"

  # Check if main.ts can be parsed (basic syntax check)
  if bun run src/main.ts --help 2>/dev/null | grep -q "Usage"; then
    log_success "Flow observer is ready"
  else
    log_warn "Could not verify with --help, but files are in place"
  fi
}

# Install Claude Code skill
install_claude_skill() {
  log_info "Installing Claude Code skill..."

  SKILL_SOURCE="$ROOT_DIR/scripts/flow-hooks/skills/flow/SKILL.md"
  SKILL_TARGET="${HOME}/.claude/skills/flow/SKILL.md"

  if [[ ! -f "$SKILL_SOURCE" ]]; then
    log_warn "Skill source not found at $SKILL_SOURCE"
    return 0
  fi

  mkdir -p "$(dirname "$SKILL_TARGET")"
  cp "$SKILL_SOURCE" "$SKILL_TARGET"

  if [[ -f "$SKILL_TARGET" ]]; then
    log_success "Claude Code skill installed to ~/.claude/skills/flow/"
  else
    log_warn "Failed to copy skill file"
  fi
}

# Print summary
print_summary() {
  echo ""
  echo "========================================"
  echo "  Setup Complete!"
  echo "========================================"
  echo ""
  echo "Design Principles: 心流 / 按需知识 / 无感使用"
  echo ""
  echo "Run Flow Observer (tmux - best for long sessions):"
  echo "  ./scripts/flow-run.sh                    # New session"
  echo "  ./scripts/flow-run.sh --continue         # Continue last session"
  echo "  ./scripts/flow-run.sh --resume <id>      # Specific session"
  echo ""
  echo "With options:"
  echo "  ./scripts/flow-run.sh \"Your prompt\"    # With initial prompt"
  echo "  ./scripts/flow-run.sh -m sonnet          # Specific model"
  echo "  FLOW_QUIET=1 ./scripts/flow-run.sh       # Minimal UI"
  echo ""
  echo "Run with Zellij (current terminal, quick tasks):"
  echo "  ./scripts/flow-run-zellij.sh"
  echo "  ./scripts/flow-run-zellij.sh -m sonnet"
  echo ""
  echo "Key Differences:"
  echo "  tmux:  Fixed session name, supports inject-to-Claude, detach/reattach"
  echo "  zellij: Unique session names, clipboard-only, native terminal feel"
  echo ""
  if [[ -f "${HOME}/.claude/skills/flow/SKILL.md" ]]; then
    echo "Claude Code skill installed to ~/.claude/skills/flow/"
    echo ""
    echo "The skill helps you:"
    echo "  - Start flow (ask: 'start flow mode')"
    echo "  - Continue session (ask: 'continue flow')"
    echo "  - Clean sessions (ask: 'clean flow sessions')"
    echo ""
    echo "Note: Flow requires an interactive terminal."
    echo ""
  fi
  echo "Architecture: Run / Capture / Guide layers"
  echo "Contracts: wiki/00-meta/schema.md, flow-summaries.ts, this README"
  echo ""
  echo "See README.md for full documentation."
  echo ""
}

# Main
main() {
  echo "========================================"
  echo "  GUI-Anything Flow Setup"
  echo "========================================"
  echo ""

  # Check if we're in the right directory
  if [[ ! -f "$ROOT_DIR/scripts/flow-run.sh" ]]; then
    log_error "This script must be run from the repository root"
    log_info "Please cd to the repository and run: ./scripts/setup.sh"
    exit 1
  fi

  install_tmux
  echo ""
  install_bun
  echo ""
  install_project_deps
  echo ""
  setup_zellij_env
  echo ""
  set_permissions
  echo ""
  verify_installation
  echo ""
  install_claude_skill
  echo ""
  print_summary
}

main "$@"
