// API + UI SERVER = the "management console" for this demo. Not part of Temporal itself —
// it's a thin Express app that:
//   1. Serves the static HTML/CSS/JS in public/ (the counter UI).
//   2. Talks to Temporal Server as a Client: starts the Workflow, sends Signals for
//      pause/resume/stop/reset/fail-now, and polls it with a Query to read the live count.
//   3. Owns the Worker process's lifecycle so the UI's "Crash Worker" button has something
//      real to kill — see spawnWorker()/crashWorker() below.
//
// None of this file is "the Workflow." If you deleted this whole file, the Workflow would
// keep running on the Temporal Server exactly as before — this is just a window into it.

import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import express from 'express';
import {
  Connection,
  Client,
  WorkflowNotFoundError,
  WorkflowExecutionAlreadyStartedError,
  WorkflowHandle,
  SignalDefinition,
} from '@temporalio/client';
import {
  counterWorkflow,
  pauseSignal,
  resumeSignal,
  stopSignal,
  resetSignal,
  failNowSignal,
  statusQuery,
  CounterState,
} from './workflows';
import { TASK_QUEUE, TEMPORAL_ADDRESS, WORKFLOW_ID } from './shared';

const PORT = Number(process.env.PORT ?? 3000);
const QUERY_TIMEOUT_MS = 2500; // how long we'll wait on a Query before assuming the Worker is down
const WORKER_RESPAWN_DELAY_MS = 4000; // how long "Crash Worker" leaves the counter frozen

// ---------------------------------------------------------------------------
// Worker process management — purely for the "Crash Worker" demo button.
// A real deployment runs the Worker as its own long-lived process/service; it wouldn't be
// spawned and killed by the API. We do it here so the durability story is one click away.
// ---------------------------------------------------------------------------

const projectRoot = path.join(__dirname, '..');
const tsNodeBin = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');

// When true, some other terminal is running the Worker (`npm run worker.watch`) and this
// API must not spawn, kill, or otherwise touch it — see the README's SKIP_WORKER_SPAWN mode.
const workerManagedByApi = process.env.SKIP_WORKER_SPAWN !== '1';

let workerProcess: ChildProcess | null = null;
let workerCrashedAt: number | null = null;
let respawnTimer: ReturnType<typeof setTimeout> | null = null;

function spawnWorker(): void {
  const child = spawn(tsNodeBin, ['src/worker.ts'], { cwd: projectRoot, stdio: 'inherit' });
  workerProcess = child;
  workerCrashedAt = null;
  child.on('exit', (code, signal) => {
    console.log(`[api] worker process exited (code=${code}, signal=${signal})`);
    if (workerProcess === child) workerProcess = null;
  });
}

function crashWorker(): boolean {
  if (!workerProcess) return false;
  workerCrashedAt = Date.now();
  workerProcess.kill('SIGKILL');
  respawnTimer = setTimeout(spawnWorker, WORKER_RESPAWN_DELAY_MS);
  return true;
}

function workerInfo() {
  return {
    managed: workerManagedByApi,
    alive: workerManagedByApi ? workerProcess !== null : null, // unknown — someone else owns it
    pid: workerProcess?.pid ?? null,
    crashedAt: workerCrashedAt,
    respawnEtaMs: workerCrashedAt ? Math.max(0, WORKER_RESPAWN_DELAY_MS - (Date.now() - workerCrashedAt)) : null,
  };
}

// ---------------------------------------------------------------------------
// Temporal Client — talks to the Server, never runs Workflow/Activity code itself.
// ---------------------------------------------------------------------------

let client: Client;

function handle(): WorkflowHandle {
  return client.workflow.getHandle(WORKFLOW_ID);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Cache of the last successful Query result, so the UI has something to show while the Worker is down. */
let lastKnownState: CounterState | null = null;

async function statusFromServer(): Promise<CounterState> {
  // Querying requires a live Worker to answer (it replays/holds the Workflow's code in
  // memory) — if the Worker process is dead, this call hangs until one becomes available.
  // We race it against a timeout so the API stays responsive and can report "Worker Down."
  return withTimeout(handle().query(statusQuery), QUERY_TIMEOUT_MS, 'status query');
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Express doesn't catch rejected Promises from async handlers on its own, and an unhandled
// rejection crashes the whole Node process by default — wrapping every route in this keeps
// one bad request (e.g. two "Start" clicks racing each other) from taking the API down.
function asyncRoute(handler: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    handler(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: 'Unexpected server error.' });
    });
  };
}

/** True once a Workflow Execution with our fixed Id exists AND is still open (not run to completion/termination). */
async function isOpen(): Promise<boolean> {
  try {
    const info = await withTimeout(handle().describe(), QUERY_TIMEOUT_MS, 'describe');
    return info.status.name === 'RUNNING' || info.status.name === 'CONTINUED_AS_NEW';
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) return false;
    throw err;
  }
}

app.get(
  '/api/status',
  asyncRoute(async (_req, res) => {
    try {
      if (!(await isOpen())) {
        lastKnownState = null;
        res.json({ started: false, reachable: true, state: null, worker: workerInfo() });
        return;
      }
      const state = await statusFromServer();
      lastKnownState = state;
      res.json({ started: true, reachable: true, state, worker: workerInfo() });
    } catch {
      // Either `describe` or `query` didn't answer in time — most likely the Worker is down.
      res.json({ started: lastKnownState !== null, reachable: false, state: lastKnownState, worker: workerInfo() });
    }
  }),
);

app.post(
  '/api/start',
  asyncRoute(async (_req, res) => {
    try {
      if (await isOpen()) {
        res.json({ started: true, alreadyRunning: true });
        return;
      }
    } catch {
      res.status(502).json({ error: 'Could not reach Temporal Server.' });
      return;
    }

    try {
      await client.workflow.start(counterWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: WORKFLOW_ID,
        args: [1000],
      });
      res.json({ started: true, alreadyRunning: false });
    } catch (err) {
      // Two "Start" clicks (or a page load racing a click) can both pass the `isOpen()`
      // check above before either one's `start()` call reaches the Server. That's fine —
      // whichever call loses the race just finds out the Workflow already exists now.
      if (err instanceof WorkflowExecutionAlreadyStartedError) {
        res.json({ started: true, alreadyRunning: true });
        return;
      }
      throw err;
    }
  }),
);

function signalRoute(route: string, signal: SignalDefinition<[]>) {
  app.post(
    route,
    asyncRoute(async (_req, res) => {
      try {
        await handle().signal(signal);
        res.json({ ok: true });
      } catch (err) {
        if (err instanceof WorkflowNotFoundError) {
          res.status(404).json({ error: 'Workflow has not been started yet.' });
          return;
        }
        res.status(502).json({ error: 'Could not reach Temporal Server / Worker.' });
      }
    }),
  );
}

signalRoute('/api/pause', pauseSignal);
signalRoute('/api/resume', resumeSignal);
signalRoute('/api/stop', stopSignal);
signalRoute('/api/reset', resetSignal);
signalRoute('/api/fail-now', failNowSignal);

app.post('/api/worker/crash', (_req, res) => {
  if (!workerManagedByApi) {
    res.status(409).json({ error: 'SKIP_WORKER_SPAWN=1 is set — this API does not manage the Worker process.' });
    return;
  }
  res.json({ crashed: crashWorker() });
});

app.post('/api/worker/start', (_req, res) => {
  if (!workerManagedByApi) {
    res.status(409).json({ error: 'SKIP_WORKER_SPAWN=1 is set — this API does not manage the Worker process.' });
    return;
  }
  if (workerProcess) {
    res.json({ started: false, alreadyRunning: true });
    return;
  }
  if (respawnTimer) clearTimeout(respawnTimer);
  spawnWorker();
  res.json({ started: true, alreadyRunning: false });
});

async function main() {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  client = new Client({ connection });

  if (workerManagedByApi) {
    spawnWorker();
  } else {
    console.log('[api] SKIP_WORKER_SPAWN=1 set — run the Worker yourself with `npm run worker.watch`.');
  }

  app.listen(PORT, () => {
    console.log(`[api] http://localhost:${PORT}`);
  });
}

function shutdown() {
  if (respawnTimer) clearTimeout(respawnTimer);
  workerProcess?.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
