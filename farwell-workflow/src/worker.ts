// WORKER = the only process that runs YOUR code.
// Loads both Workflow Definitions (workflows.ts) and Activities (activities.ts).
// Polls task queue "translation-tasks" — same name the Client uses.
//
// Temporal Server (:7233) does not run this file. If the Server is down, this crashes
// with ECONNREFUSED. Restart: `npm run worker.watch` after `temporal server start-dev`.
//
// One Worker is enough for greeting + thanks. New process only if you want another queue.

import { Worker } from '@temporalio/worker';
import * as activities from './activities';

/** Connect to Temporal Server, register Workflows + Activities, poll the Task Queue. */
async function run() {
  const worker = await Worker.create({
    // Workflow Definitions — greeting and thanks
    workflowsPath: require.resolve('./workflows'),
    // Activity Definitions — the real HTTP functions from activities.ts
    activities,
    // Inbox name. Client must use this exact string.
    taskQueue: 'translation-tasks',
  });

  // Blocks forever: poll, run a Task, send the result back to the Server.
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
