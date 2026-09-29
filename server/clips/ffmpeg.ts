// Runs ffmpeg for a clip: an argument array (never a shell), a time limit, and stdout collected in memory.
import { spawn } from 'node:child_process';

// The tail of stderr is enough to explain a failure.
const STDERR_KEPT = 2000;

function lastLine(text: string): string {
  return text.trim().split(/\r?\n/).pop() ?? '';
}

export function runFfmpeg(ffmpegPath: string, args: readonly string[], timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_KEPT);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`ffmpeg took longer than ${timeoutMs} ms`));
      else if (code !== 0) reject(new Error(`ffmpeg exited with code ${code}: ${lastLine(stderr)}`));
      else resolve(Buffer.concat(chunks));
    });
  });
}
