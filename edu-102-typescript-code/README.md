# Temporal 102 (TypeScript) exercises

Course code from [Temporal 102](https://learn.temporal.io/courses/temporal_102), kept as a folder in this learning repo (not a nested git repo).

Work in each exercise’s `practice/` directory. `solution/` is the finished version if you get stuck.

## Run locally

In its own terminal (leave it running):

```bash
temporal server start-dev --ui-port 8080 --db-filename clusterdata.db
```

- Server: `localhost:7233`
- UI: [http://localhost:8080](http://localhost:8080)

`--db-filename` keeps history after a restart. `clusterdata.db` is local only — do not commit it.

Each exercise is its own Node project:

```bash
cd exercises/durable-execution/practice
command npm install
```

Then follow that exercise’s README.

## Exercises

| Directory | What it teaches |
|---|---|
| [exercises/durable-execution](exercises/durable-execution/README.md) | Kill a Worker mid-Timer; another Worker finishes. Completed Activities are not re-run. |
| [exercises/testing-code](exercises/testing-code/README.md) | Activity + Workflow tests; time-skipping. |
| [exercises/debug-activity](exercises/debug-activity/README.md) | Find a failing Activity in the UI; fix it; in-flight Execution completes on retry. |

## Samples

| Directory | Description |
|---|---|
| [samples/age-estimation](samples/age-estimation) | Call a remote API to estimate age from a name |
| [samples/using-objects](samples/using-objects) | Objects as Workflow input and output |

## Docs

- [Temporal docs](https://docs.temporal.io/)
- [TypeScript SDK](https://typescript.temporal.io)
- [Local TypeScript setup](https://learn.temporal.io/getting_started/typescript/dev_environment/)
