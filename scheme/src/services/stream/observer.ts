import { spawn } from "node:child_process";
import readline from "node:readline";

interface ObserverOptions {
  prompt: string;
  onEvent: (raw: string) => void;
  onExit: () => void;
}

// Observer mode: spawn claude in stream-json mode, emit raw JSON lines for the TUI to parse
export function startObserverStream(options: ObserverOptions) {
  const command = process.env.CLAUDE_COMMAND?.trim() || "claude";
  const args = ["--print", "--output-format", "stream-json", "--verbose"];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });

  child.stdin.write(options.prompt);
  child.stdin.end();

  const stdoutReader = readline.createInterface({ input: child.stdout });
  const stderrReader = readline.createInterface({ input: child.stderr });

  stdoutReader.on("line", (line) => {
    options.onEvent(line);
  });
  stderrReader.on("line", () => {
    // ignore stderr in observer mode
  });

  child.on("close", () => {
    options.onExit();
  });

  child.on("error", () => {
    options.onExit();
  });

  return {
    stop: () => {
      stdoutReader.close();
      stderrReader.close();
      if (!child.killed) child.kill("SIGINT");
    }
  };
}
