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
  options.onStart?.({ command, args });

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });

  if (!options.prompt) {
    options.onExit({
      code: null,
      signal: null,
      error: "no prompt provided"
    });
    child.kill("SIGINT");
    return { stop: () => undefined };
  }

  child.stdin.write(options.prompt);
  child.stdin.end();

  const stdoutReader = readline.createInterface({ input: child.stdout });
  const stderrReader = readline.createInterface({ input: child.stderr });

  stdoutReader.on("line", options.onStdoutLine);
  stderrReader.on("line", options.onStderrLine);

  child.on("error", (err) => {
    options.onExit({ code: null, signal: null, error: err.message });
  });

  child.on("close", (code, signal) => {
    options.onExit({ code, signal });
  });

  const stop = () => {
    stdoutReader.close();
    stderrReader.close();
    if (child.killed) return;
    child.kill("SIGINT");
  };

  return { stop };
}
