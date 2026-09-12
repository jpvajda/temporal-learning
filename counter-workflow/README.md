# counter-workflow

A Temporal Workflow that counts up, forever, one tick a second — plus a tiny HTML page to
watch it do that. This is the simplest possible demo of **durable execution**: the counter
never resets and never gets stuck, no matter how many things fail around it.

```
1, 2, 3, FAILURE, 4, 5, 6, FAILURE, 7, 8, ...
```

## The idea

- `counterWorkflow` loops forever: call the `tick` Activity, increment `count`, sleep a
  second, repeat.
- `tick` (in `activities.ts`) simulates a flaky dependency — it fails on its own about 1 in
  5 calls, and you can force it to fail on demand from the UI.
- When `tick` fails, the Workflow does **not** crash and does **not** reset `count`. It logs
  the failure (visible in the "Failure log" panel) and moves on to the next tick.
- `count`, `status`, and the failure log are all Workflow state. Temporal durably persists
  every change to that state on the Server as it happens — this is what actually makes the
  demo interesting, not the `try`/`catch`. See "Try this" below.

## Project layout

- `src/workflows.ts` — `counterWorkflow`: the loop, its Signals (`pause`, `resume`, `stop`,
  `reset`, `failNow`), and its Query (`status`).
- `src/activities.ts` — `tick`: the one place that's allowed to be flaky/non-deterministic.
- `src/worker.ts` — connects to the Server, polls task queue `counter-tasks`.
- `src/client.ts` — optional CLI: starts the Workflow without the UI.
- `src/api.ts` — a small Express server that (1) serves `public/` (the UI), (2) is a
  Temporal **Client** — starts the Workflow, sends Signals, runs the Query — and (3) spawns
  and can kill/restart the Worker process, purely so the UI's "Crash Worker" button has a
  real process to kill.
- `public/` — the UI itself: `index.html`, `style.css`, and one vanilla-JS file
  (`app.js`, no framework) that polls `/api/status` once a second and renders it.

## Running it

You need a local Temporal Server (see the [repo README](../README.md#running-the-local-temporal-server)):

```bash
temporal server start-dev
```

Then, from this folder, in a second terminal:

```bash
npm install
npm run api
```

`npm run api` starts the Express/API server **and** spawns the Worker as a child process
for you. Open [http://localhost:3000](http://localhost:3000) and click **Start**.

Prefer to run the Worker yourself in its own terminal (matching the other examples in this
repo)? Set `SKIP_WORKER_SPAWN=1` and use `npm run worker.watch` instead:

```bash
SKIP_WORKER_SPAWN=1 npm run api    # terminal 2: API + UI, no auto-spawned Worker
npm run worker.watch               # terminal 3: the Worker, auto-restarts on save
```

In this mode the UI's "Crash Worker" / "Start Worker" buttons won't have a process to
manage — use `Ctrl+C` / restart `worker.watch` manually instead (see "Try this" below).

## Using the UI

- **Start / Pause / Resume / Stop / Reset count** — control the Workflow via Signals.
  Pausing suspends the Workflow with a durable `condition()` wait, not a polling loop.
- **Trigger failure (next tick)** — signals the Workflow to force the *next* `tick` to fail,
  so you don't have to wait on the ~20% natural failure rate.
- **Crash Worker process** — `SIGKILL`s the Worker process outright. The count freezes (the
  UI shows "worker unreachable") because nothing is running your Workflow code — the Server
  is just holding durable state, waiting. It auto-restarts after ~4 seconds, and the count
  resumes at the exact value it left off at.
  - You may see the count jump by more than expected right after it resumes. That's real:
    the timer between ticks is a **durable Server-side timer**, so it kept ticking the
    whole time the Worker was down. The new Worker just has a small backlog of already-due
    ticks to burn through — none of them are lost or double-counted.

## Try this

1. Click **Start**, watch it count for a bit, then click **Crash Worker process**.
2. Watch the badge change to "running (worker unreachable)" and the count freeze.
3. Wait ~4 seconds for the auto-restart, or open the Temporal Web UI
   ([http://localhost:8233](http://localhost:8233)) and watch the Workflow's pending task
   queue while the Worker is down.
4. Watch the count pick back up — same Workflow Execution, no restart, no lost ticks.

This is the whole point of Temporal: your process can die, and the thing it was doing
doesn't die with it.
