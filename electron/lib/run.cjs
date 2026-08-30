const { execFile, spawn } = require('node:child_process');

const IS_WIN = process.platform === 'win32';

/** Runs a command and resolves with its output, never throwing on a non-zero exit. */
function run(command, args = [], options = {}) {
  const timeout = options.timeout ?? 15000;
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024, cwd: options.cwd, encoding: 'utf8' },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error?.code ?? 0,
          stdout: (stdout || '').toString(),
          stderr: (stderr || error?.message || '').toString(),
        });
      },
    );
  });
}

/** Runs a PowerShell snippet on Windows. Resolves with `ok: false` elsewhere. */
function powershell(script, options = {}) {
  if (!IS_WIN) return Promise.resolve({ ok: false, code: -1, stdout: '', stderr: 'windows only' });
  return run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    options,
  );
}

/** PowerShell helper that parses `ConvertTo-Json` output, returning [] on failure. */
async function powershellJson(script, options = {}) {
  const wrapped = `$ProgressPreference='SilentlyContinue'; ${script} | ConvertTo-Json -Depth 4 -Compress`;
  const result = await powershell(wrapped, options);
  if (!result.ok || !result.stdout.trim()) return [];
  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** Starts a detached program and returns immediately, the hub never owns its lifetime. */
function launchDetached(command, args = [], options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    cwd: options.cwd,
    shell: options.shell ?? false,
  });
  child.unref();
  return child.pid;
}

/** True when a binary answers on the PATH, used to gate ffmpeg powered tools. */
async function hasBinary(binary) {
  const probe = IS_WIN ? await run('where', [binary]) : await run('which', [binary]);
  return probe.ok && probe.stdout.trim().length > 0;
}

module.exports = { IS_WIN, run, powershell, powershellJson, launchDetached, hasBinary };
