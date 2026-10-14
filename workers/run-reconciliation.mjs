// Explicit CLI only; never imported by the portfolio or installed as a service automatically.
import { open, lstat, mkdir, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createDispatcher, workerConfig } from './reconciliation.mjs';

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('WORKER_NODE_24_REQUIRED');
  const command = process.argv.slice(2);
  if (command.length !== 1 || !['--check', '--run'].includes(command[0])) throw new Error('WORKER_COMMAND_INVALID');
  const config = workerConfig(process.env);
  if (!config.enabled) { console.log('DISABLED'); return; }
  if (command[0] === '--check') { console.log('CONFIGURATION_READY_NOT_RUNNING'); return; }
  const directory = process.env.RECONCILIATION_WORKER_STATE_DIR;
  if (!directory || !isAbsolute(directory)) throw new Error('WORKER_STATE_DIRECTORY_REQUIRED');
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
      (process.platform !== 'win32' && ((metadata.mode & 0o077) || metadata.uid !== process.getuid()))) {
    throw new Error('WORKER_STATE_DIRECTORY_UNSAFE');
  }
  const pausePath = join(directory, 'paused.json'), lockPath = join(directory, 'instance.lock');
  try { await lstat(pausePath); console.log('PAUSED_REVIEW_REQUIRED'); process.exitCode = 1; return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lock = await open(lockPath, 'wx', 0o600); // Never steal a stale lock after a crash.
  await lock.close();
  let safeToUnlock = false;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    // Recheck under the lock: another instance might have paused between the first check and acquisition.
    try { await lstat(pausePath); console.log('PAUSED_REVIEW_REQUIRED'); process.exitCode = 1; safeToUnlock = true; return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const dispatcher = createDispatcher(config, {
      async persistPause(reason) {
        const file = await open(pausePath, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify({ reason, at: new Date().toISOString() })); await file.sync(); }
        finally { await file.close(); }
      },
    });
    let lastHealthAt = 0;
    while (!controller.signal.aborted) {
      const result = await dispatcher.tick(controller.signal);
      // Only fixed states/counters reach logs; never errors, bodies, headers or credentials.
      if (result.state === 'PAUSED') { console.error('PAUSED_REVIEW_REQUIRED'); process.exitCode = 1; break; }
      if (result.state === 'STOPPED') break;
      if (result.state === 'BACKOFF') console.error('TRANSIENT_FAILURE_BACKOFF');
      if (result.state === 'HEALTHY' && Date.now() - lastHealthAt >= 60000) {
        console.log(`HEALTHY checked=${result.checked} deferred=${result.deferred}`);
        lastHealthAt = Date.now();
      }
      try { await sleep(result.delayMs ?? 1000, undefined, { signal: controller.signal }); }
      catch (error) { if (!controller.signal.aborted) throw error; }
    }
    safeToUnlock = true;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (safeToUnlock) await unlink(lockPath);
  }
}

main().catch(() => { console.error('WORKER_STOPPED_REVIEW_CONFIGURATION_OR_STATE'); process.exitCode = 1; });
