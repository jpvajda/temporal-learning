# temporal-learning

A learning project for [Temporal](https://temporal.io), using the TypeScript SDK.

## What is Temporal?

Temporal is a durable execution platform. You write regular code — functions
that call other functions — and Temporal makes that code resilient without
you writing the retry loops, state machines, and crash-recovery logic
yourself.

Concretely, Temporal gives you:

- **Automatic retries.** If a step calls an API and it fails (timeout, 500,
  network blip), Temporal retries it based on a policy you configure. You
  don't write `try/catch` + backoff loops.
- **Durable state.** Every step and its result is recorded on the Temporal
  Server as it happens. If your process crashes mid-task, a new process can
  pick up exactly where it left off — completed steps are never re-run.
- **Long-running processes made simple.** A "workflow" can run for seconds
  or months (waiting on a human approval, a scheduled task, an external
  event) without you managing timers, queues, or a database schema for
  state.
- **Full visibility.** The Temporal Web UI shows the exact history of every
  execution — what ran, in what order, what it returned, and what failed —
  without you writing custom logging for it.

The trade-off: you write your code in two parts.

- **Workflow** — the orchestration logic ("do step 1, then step 2, then
  step 3"). This code must be deterministic: no direct network/API calls, no
  random values, no reading the current time directly.
- **Activity** — the actual side effects (HTTP calls, database writes,
  anything non-deterministic or that can fail). Activities are what
  Temporal retries.

A **Worker** is the process that runs your Workflow and Activity code. It
connects to the Temporal Server and executes tasks as they come in. A
**Client** is how you start a Workflow (from a script, an API, a CLI, etc.).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (this repo was built with v22+)
- [Temporal CLI](https://docs.temporal.io/cli) — installs a local dev server:
  ```bash
  brew install temporal
  ```

## Running the local Temporal Server

Every example needs a Temporal Server running locally. In its own terminal
(leave it running for the whole session):

```bash
temporal server start-dev
```

- Server: `localhost:7233`
- Web UI: [http://localhost:8233](http://localhost:8233)

`Ctrl+C` stops it. Since it uses an in-memory database by default, stopping
it clears all Workflow history.

## Examples in this repo

Each folder below is a **separate, self-contained Node project** with its
own `package.json`. `cd` into a folder, run `npm install` once, then follow
its instructions. Don't mix `node_modules` between them.

### `hello-world/`

The smallest possible Temporal app: one Workflow that calls one Activity.

- `src/workflows.ts` — Workflow `example(name)` calls the `greet` Activity.
- `src/activities.ts` — Activity `greet(name)` returns `Hello, ${name}!`.
- `src/worker.ts` — connects to the server and polls task queue
  `hello-world`.
- `src/client.ts` — starts the Workflow and prints the result.

Run it (from `hello-world/`, in two terminals):

```bash
npm install
npm run start.watch   # terminal 1: the Worker (auto-restarts on save)
npm run workflow      # terminal 2: starts the Workflow, prints the result
```

Expected output: `Hello, Temporal!`

### `farwell-workflow/`

Based on the [Temporal 101 in TypeScript course](https://learn.temporal.io)
"Farewell Workflow" exercise. Demonstrates a Workflow calling **two**
Activities in sequence, plus what happens when a dependency (a fake HTTP
API) goes down.

- `src/service.ts` — a small Express server on port `9999` that plays the
  role of an unreliable third-party API. It returns Spanish greetings and
  farewells for a given name.
- `src/activities.ts` — `getSpanishGreeting` and `getSpanishFarewell`, each
  calling the fake API over HTTP.
- `src/workflows.ts` — Workflow `greeting(name)` calls both Activities and
  returns the combined result.
- `src/worker.ts` — polls task queue `translation-tasks`.
- `src/clients/greeting.ts` — starts the Workflow for a given name.

Run it (from `farwell-workflow/`, in three terminals):

```bash
npm install
npm run service.watch  # terminal 1: the fake API
npm run worker.watch   # terminal 2: the Worker
npm run greeting       # terminal 3: starts the Workflow, prints the result
```

Expected output:

```
¡Hola, Tina!
¡Adiós, Tina!
```

**Try this:** stop `service.watch` (`Ctrl+C`), then run `npm run greeting`
again. Open the Web UI and watch the Activity retry against the down API.
Restart the service — the next retry succeeds and the Workflow completes,
picking up right where it left off instead of starting over.

## Useful links

- [Temporal Docs](https://docs.temporal.io)
- [Learn Temporal](https://learn.temporal.io) — the source of the tutorials
  used in this repo
- [TypeScript SDK API reference](https://typescript.temporal.io)
