// WORKER = the only process that runs YOUR code (workflows.ts + activities.ts).
// Temporal Server (:7233) just stores history and hands out tasks — it never executes
// your TypeScript. If this process dies, the Server keeps every Workflow's state exactly
// as it was; nothing runs until a Worker (this file, restarted) polls the task queue again.
//
// That's what the API's "Crash Worker" button demonstrates: it SIGKILLs this exact
// process, waits a few seconds, then starts a new one. The counter Workflow doesn't notice
// anything happened except a gap in time.

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { TASK_QUEUE, TEMPORAL_ADDRESS } from './shared';

async function run() {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: TASK_QUEUE,
      // Workflows run in a separate deterministic sandbox context, so they're registered
      // by path rather than imported directly here.
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    console.log(`[worker] pid ${process.pid} polling task queue "${TASK_QUEUE}"`);
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
