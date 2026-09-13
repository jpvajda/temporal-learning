# Temporal Money Transfer example in TypeScript

Companion code for [Run your first Temporal Application with TypeScript](https://learn.temporal.io/getting_started/typescript/first_program_in_typescript).

Withdraws from one account, deposits into another. If deposit fails, it refunds.

**Client** starts the transfer. **Worker** runs the Workflow and Activities. They do not talk to each other — both talk to Temporal (local or Cloud).

## One-time setup

```bash
cd money-transfer-project-template-ts
command npm install
```

Use `command npm` if your `npm` is aliased to Socket/pnpm (that alias breaks this install).

## Run against Temporal Cloud

Needs a Temporal CLI profile named `cloud` in `~/Library/Application Support/temporalio/temporal.toml` (address, API key, namespace). This sample reads that profile via `TEMPORAL_PROFILE`.

**Both** commands need the env var. If only the Client has it, the Worker polls localhost and never sees the Cloud Workflow.

**Order — two terminals, leave the Worker running:**

1. Worker first (terminal 1). Leave it up. It polls Cloud for tasks.

```bash
TEMPORAL_PROFILE=cloud npm run worker
```

2. Client second (terminal 2). Starts one transfer, then waits for the result.

```bash
TEMPORAL_PROFILE=cloud npm run client
```

Watch it in the [Temporal Cloud UI](https://cloud.temporal.io) — Namespace from your `cloud` profile (not `localhost:8233`).

Expected Client output:

```
Starting transfer from account 85-150 to account 43-812 for $400
Started Workflow pay-invoice-801 with RunID ...
Transfer complete (transaction IDs: W..., D...)
```

### Why this order

| You start | What happens |
|---|---|
| Worker, then Client | Worker is already polling. Transfer runs immediately. |
| Client, then Worker | Workflow is created in Cloud and sits **Running** until a Worker starts. Then it finishes. |
| Client twice while `pay-invoice-801` is still open | `WorkflowExecutionAlreadyStartedError`. Temporal allows one open Execution per Workflow Id. Wait for it to complete, or Terminate it in the Cloud UI, then run Client again. |

The Worker does not have to be running *before* the Client for the start to succeed. It does have to be running *sometime* for the work to execute.

## Run locally instead

No `TEMPORAL_PROFILE`. Needs `temporal server start-dev` in its own terminal first.

```bash
# terminal 1
temporal server start-dev
```

```bash
# terminal 2
npm run worker
```

```bash
# terminal 3
npm run client
```

UI: [http://localhost:8233](http://localhost:8233)

## Connection

[`@temporalio/envconfig`](https://typescript.temporal.io/api/namespaces/envconfig) loads the Temporal CLI profile. No profile → `localhost:7233`, Namespace `default`. `TEMPORAL_PROFILE=cloud` → whatever is in that profile.
