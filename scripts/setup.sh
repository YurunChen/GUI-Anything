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
  log_info "Checking Zellij installation (required for flow)..."
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

  if [[ -f "bun.lock" ]]; then
    log_info "Lockfile detected. Running bun install --frozen-lockfile..."
    if ! bun install --frozen-lockfile; then
      log_warn "Frozen lockfile install failed. Falling back to bun install."
      bun install
    fi
  else
    log_warn "bun.lock not found. Running bun install without frozen lockfile."
    bun install
  fi

  # Verify OpenTUI is installed
  if [[ ! -d "node_modules/@opentui" ]]; then
    log_error "Dependency installation may have failed"
    log_info "Trying one more time..."
    bun install
  fi

  log_success "Dependencies installed successfully"
}

# Check Claude Code CLI availability
check_claude_cli() {
  log_info "Checking Claude Code CLI..."
  if command_exists claude; then
    local claude_version
    claude_version="$(claude --version 2>/dev/null || true)"
    log_success "Claude CLI found${claude_version:+: $claude_version}"
    return 0
  fi

  log_warn "Claude CLI not found in PATH."
  log_info "Install Claude Code CLI and ensure 'claude' is available before running flow scripts."
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

  SKILL_SOURCE="$ROOT_DIR/docs/skills/flow/SKILL.md"
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
  echo "Run Flow Observer (recommended: ga flow):"
  echo "  ga flow"
  echo "  ga flow --continue"
  echo "  ga flow --resume <id>"
  echo ""
  echo "Or:"
  echo "  ./scripts/flow-run.sh"
  echo "  ./scripts/flow-run.sh -m sonnet \"Your prompt\""
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
  echo "See docs/development.md for architecture and extension guide."
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

  install_bun
  echo ""
  install_project_deps
  echo ""
  check_claude_cli
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
