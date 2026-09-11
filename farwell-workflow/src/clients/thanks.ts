// CLIENT for the `thanks` Workflow. Same pattern as greeting.ts — different Workflow Definition.
// Run: `npm run thanks`

import { Client } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import { thanks } from '../workflows';

async function run() {
  const client = new Client();
  const result = await client.workflow.execute(thanks, {
    args: ['Tina'],
    taskQueue: 'translation-tasks', // must match worker.ts
    workflowId: 'workflow-' + randomUUID(),
  });
  console.log(`The thanks Workflow returned: ${result}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
