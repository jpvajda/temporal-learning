// ACTIVITY = the one place non-determinism and "real world" flakiness are allowed to live.
// Workflows can't call Math.random() or setTimeout() directly and stay deterministic —
// Activities are how a Workflow reaches out into the messy, unreliable outside world.
//
// This Activity is called once per counter tick (see workflows.ts). Its Retry Policy is
// set to `maximumAttempts: 1` (no automatic Temporal retries), so every failure here comes
// straight back to the Workflow to record and move past, instead of being retried silently
// behind the scenes.

const NATURAL_FAILURE_RATE = 0.2; // ~1 in 5 ticks "fails" on its own, no button needed
const SIMULATED_WORK_MS = 250; // pretend this does a little bit of real work

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates one unit of work behind the counter — think "call a flaky third-party API" or
 * "write a row to a database that's having a bad day." `forceFail` lets the UI's
 * "Trigger Failure" button make this fail on demand instead of waiting on the dice roll.
 */
export async function tick(forceFail: boolean): Promise<void> {
  await delay(SIMULATED_WORK_MS);

  if (forceFail) {
    throw new Error('Manually triggered failure');
  }
  if (Math.random() < NATURAL_FAILURE_RATE) {
    throw new Error('Simulated flaky dependency failure');
  }
}
