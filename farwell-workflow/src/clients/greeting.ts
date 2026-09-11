// CLIENT = start a Workflow Execution. Does not run the Workflow or Activities.
// Talks to Temporal Server (:7233). Worker on the same taskQueue picks it up.
//
// execute() waits until the Workflow finishes, then prints the result.
// Run: `npm run greeting`  (Server + Worker + service must already be up.)

import { Client } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { greeting } from '../workflows';

async function run() {
  const client = new Client();
  const result = await client.workflow.execute(greeting, {
    args: ['Tina'],
    taskQueue: 'translation-tasks', // must match worker.ts
    workflowId: 'workflow-' + randomUUID(),
  });
  console.log(`The greeting Workflow returned: ${result}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
