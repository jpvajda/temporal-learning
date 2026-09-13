// Constants shared by every process in this example (Worker, API, CLI client) so they
// always agree on where to connect and which Workflow they're talking about.

export const TEMPORAL_ADDRESS = 'localhost:7233';
export const TASK_QUEUE = 'counter-tasks';

// Fixed on purpose: this whole demo is about ONE long-running counter you can poke at
// from the UI, so every process refers to the same Workflow Id instead of minting new ones.
export const WORKFLOW_ID = 'counter-demo';
