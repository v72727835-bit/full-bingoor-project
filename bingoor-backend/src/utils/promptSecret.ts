import readline from 'readline';

/**
 * Reads a secret for a CLI script without exposing it in `ps aux` / shell
 * history (ISSUE-15). Order of precedence:
 *   1. the given environment variable (good for CI / non-interactive use), then
 *   2. a prompt on an interactive TTY, with the typed characters hidden.
 * Passing secrets as command-line arguments is no longer supported.
 */
export async function readSecret(envVar: string, label: string): Promise<string> {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new Error(`Set ${envVar} in the environment (no interactive terminal to prompt for ${label}).`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Hide the typed characters.
  const asMutable = rl as unknown as { output?: NodeJS.WriteStream; _writeToOutput?: (s: string) => void };
  asMutable._writeToOutput = (str: string) => {
    if (str.includes(label)) asMutable.output?.write(str);
    // swallow echoed keystrokes
  };
  try {
    const value = await new Promise<string>((resolve) => rl.question(`${label}: `, resolve));
    process.stdout.write('\n');
    return value.trim();
  } finally {
    rl.close();
  }
}
