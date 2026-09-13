// Optional CLI helper: starts the counter Workflow without going through the HTML UI.
// The UI's "Start" button (served by api.ts) does the same thing — this file exists so
// you can also kick it off from a terminal, matching the other examples in this repo.

import { Connection, Client } from '@temporalio/client';
import { counterWorkflow } from './workflows';
import { TASK_QUEUE, TEMPORAL_ADDRESS, WORKFLOW_ID } from './shared';

async function run() {
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection });

  const handle = await client.workflow.start(counterWorkflow, {
    taskQueue: TASK_QUEUE,
    args: [1000], // tick every 1 second
    workflowId: WORKFLOW_ID,
  });

  console.log(`Started workflow "${handle.workflowId}".`);
  console.log('Run `npm run api` and open http://localhost:3000 to watch it count.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
