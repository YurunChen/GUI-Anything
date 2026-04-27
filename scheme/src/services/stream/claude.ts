import { spawn } from "node:child_process";
import readline from "node:readline";

interface StreamExitResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}

interface StartInfo {
  command: string;
  args: string[];
}

interface StartClaudeStdoutStreamOptions {
  prompt: string;
  onStdoutLine: (line: string) => void;
  onStderrLine: (line: string) => void;
  onStart?: (info: StartInfo) => void;
  onExit: (result: StreamExitResult) => void;
}

interface StreamHandle {
  stop: () => void;
}

function getClaudeCommand(): string {
  return process.env.CLAUDE_COMMAND?.trim() || "claude";
}

function getExtraArgs(): string[] {
  const raw = process.env.CLAUDE_EXTRA_ARGS?.trim();
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

export function startClaudeStdoutStream(options: StartClaudeStdoutStreamOptions): StreamHandle {
  const command = getClaudeCommand();
  // --print runs non-interactively: feed prompt, get response, exit
  const args = ["--print", "--output-format", "stream-json", "--verbose", ...getExtraArgs()];

  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Send prompt to stdin
  child.stdin.write(options.prompt);
  child.stdin.end();

  // Notify started
  if (options.onStart) {
    options.onStart({ command, args });
  }

  // Read stdout line by line
  const rlOut = readline.createInterface({ input: child.stdout });
  rlOut.on("line", (line) => {
    options.onStdoutLine(line);
  });

  // Read stderr line by line
  const rlErr = readline.createInterface({ input: child.stderr });
  rlErr.on("line", (line) => {
    options.onStderrLine(line);
  });

  let exited = false;
  const finalize = (code: number | null, signal: NodeJS.Signals | null, error?: string) => {
    if (exited) return;
    exited = true;
    options.onExit({ code, signal, error });
  };

  child.on("exit", (code, signal) => {
    finalize(code, signal);
  });

  child.on("error", (err) => {
    finalize(null, null, err.message);
  });

  return {
    stop: () => {
      if (!exited) {
        child.kill("SIGTERM");
      }
    },
  };
}
