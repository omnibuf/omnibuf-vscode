import { execFile, spawn } from 'node:child_process';

export interface DecodeOptions {
  cliPath: string;
  schemaPath?: string;
  messageType?: string;
  timeoutMs?: number;
}

export interface EncodeOptions {
  cliPath: string;
  schemaPath?: string;
  messageType?: string;
  includeField0?: boolean;
  deterministic?: boolean;
  timeoutMs?: number;
}

export interface DecodeResult {
  ok: true;
  json: string;
}

export interface DecodeError {
  ok: false;
  code: 'ENOENT' | 'DECODE_FAILED';
  message: string;
}

export type DecodeOutcome = DecodeResult | DecodeError;

export interface EncodeResult {
  ok: true;
  bytes: Uint8Array;
}

export interface EncodeError {
  ok: false;
  code: 'ENOENT' | 'ENCODE_FAILED';
  message: string;
}

export type EncodeOutcome = EncodeResult | EncodeError;

export function buildDecodeArgs(
  filePath: string,
  options: Pick<DecodeOptions, 'schemaPath' | 'messageType'>,
): string[] {
  const args = ['decode'];
  const schema = options.schemaPath?.trim();
  const typeName = options.messageType?.trim();
  if (schema) {
    args.push('-s', schema);
  }
  if (typeName) {
    args.push('-t', typeName);
  }
  args.push('-i', filePath);
  return args;
}

export function buildEncodeArgs(
  options: Pick<EncodeOptions, 'schemaPath' | 'messageType' | 'includeField0' | 'deterministic'>,
): string[] {
  const args = ['encode'];
  const schema = options.schemaPath?.trim();
  const typeName = options.messageType?.trim();
  if (schema) {
    args.push('-s', schema);
  } else if (options.includeField0 === false) {
    args.push('--no-field0');
  }
  if (typeName) {
    args.push('-t', typeName);
  }
  if (options.deterministic) {
    args.push('--deterministic');
  }
  return args;
}

export function decodeFile(filePath: string, options: DecodeOptions): Promise<DecodeOutcome> {
  const cliPath = options.cliPath.trim() || 'omnibuf';
  const args = buildDecodeArgs(filePath, options);
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise((resolve) => {
    execFile(
      cliPath,
      args,
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: timeoutMs,
      },
      (err, stdout, stderr) => {
        if (err) {
          const errno = err as NodeJS.ErrnoException;
          if (errno.code === 'ENOENT') {
            resolve({
              ok: false,
              code: 'ENOENT',
              message: `Could not find the "${cliPath}" executable. Install omnibuf CLI (e.g. brew install omnibuf/tap/omnibuf) or set omnibuf.cliPath in VS Code settings.`,
            });
            return;
          }
          const detail = stderr.trim() || err.message;
          resolve({
            ok: false,
            code: 'DECODE_FAILED',
            message: detail,
          });
          return;
        }
        resolve({
          ok: true,
          json: stdout.trimEnd() || '{}',
        });
      },
    );
  });
}

export function encodeJson(jsonText: string, options: EncodeOptions): Promise<EncodeOutcome> {
  const cliPath = options.cliPath.trim() || 'omnibuf';
  const args = buildEncodeArgs(options);
  const timeoutMs = options.timeoutMs ?? 15_000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: EncodeOutcome) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(outcome);
      }
    };

    const child = spawn(cliPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        ok: false,
        code: 'ENCODE_FAILED',
        message: `omnibuf encode timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        finish({
          ok: false,
          code: 'ENOENT',
          message: `Could not find the "${cliPath}" executable. Install omnibuf CLI (e.g. brew install omnibuf/tap/omnibuf) or set omnibuf.cliPath in VS Code settings.`,
        });
        return;
      }
      finish({
        ok: false,
        code: 'ENCODE_FAILED',
        message: err.message,
      });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        finish({
          ok: false,
          code: 'ENCODE_FAILED',
          message: stderr || `omnibuf encode exited with status ${code}`,
        });
        return;
      }
      finish({
        ok: true,
        bytes: new Uint8Array(Buffer.concat(stdoutChunks)),
      });
    });

    child.stdin.on('error', () => {
      // Ignore EPIPE if process exits early; 'close' or 'error' will report the reason.
    });
    child.stdin.end(jsonText, 'utf8');
  });
}
