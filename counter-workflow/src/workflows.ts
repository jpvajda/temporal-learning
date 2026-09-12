// WORKFLOW DEFINITION = the durable state machine. Deterministic only: no Math.random(),
// no direct setTimeout, no network calls, no reading the system clock for logic. All of
// that lives in activities.ts. This file only decides "what happens next."
//
// What this Workflow does: count up by 1, forever, one tick at a time, until told to stop.
// Every tick it calls the `tick` Activity — that's where a simulated flaky dependency lives.
// When `tick` fails, this Workflow does NOT crash and does NOT reset the counter. It records
// the failure and moves on to the next tick. That's the whole demo:
//
//     1, 2, 3, FAILURE, 4, 5, 6, FAILURE, 7, 8, ...
//
// The deeper point is durability, not the try/catch: `count`, `failures`, and `status`
// below are Workflow state, and Temporal durably persists every change to that state (as
// Workflow History) on the Server as it happens — not just when the Workflow finishes.
//
// Try this: while the counter is running, kill the Worker process (the "Crash Worker"
// button in the UI does this for you). No process is running your Workflow code for a few
// seconds — the count freezes, the UI can't reach it. Restart the Worker (it auto-restarts
// after ~4s) and the count resumes at the exact number it left off at. Nothing was lost,
// nothing double-counted, and the Workflow never "knew" it was interrupted.

import {
  proxyActivities,
  setHandler,
  condition,
  sleep,
  defineSignal,
  defineQuery,
  rootCause,
} from '@temporalio/workflow';
import type * as activities from './activities';

const { tick } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  // Off on purpose — see activities.ts. We want every failure to come straight back here.
  retry: { maximumAttempts: 1 },
});

export interface FailureEvent {
  /** The count value at the moment this tick failed (the counter did NOT advance past this). */
  atCount: number;
  message: string;
  /** Epoch ms. Safe to read inside a Workflow: the SDK's Date is replay-deterministic. */
  timestamp: number;
}

export type CounterStatus = 'running' | 'paused' | 'stopped';

export interface CounterState {
  count: number;
  status: CounterStatus;
  failureCount: number;
  /** Most recent failures only (see MAX_FAILURES_KEPT) — keeps Workflow state small forever. */
  failures: FailureEvent[];
  tickIntervalMs: number;
}

const MAX_FAILURES_KEPT = 20;

export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const stopSignal = defineSignal('stop');
export const resetSignal = defineSignal('reset');
export const failNowSignal = defineSignal('failNow');
export const statusQuery = defineQuery<CounterState>('status');

/** Counts up forever, one tick at a time, until stopped. State survives crashes — see above. */
export async function counterWorkflow(tickIntervalMs = 1000): Promise<CounterState> {
  let count = 0;
  let paused = false;
  let stopped = false;
  let failOnNextTick = false;
  let failureCount = 0;
  const failures: FailureEvent[] = [];

  setHandler(pauseSignal, () => {
    paused = true;
  });
  setHandler(resumeSignal, () => {
    paused = false;
  });
  setHandler(stopSignal, () => {
    stopped = true;
    paused = false; // don't leave `stop` waiting on the paused condition below
  });
  setHandler(resetSignal, () => {
    count = 0;
    failureCount = 0;
    failures.length = 0;
  });
  setHandler(failNowSignal, () => {
    failOnNextTick = true;
  });
  setHandler(statusQuery, () => ({
    count,
    status: stopped ? 'stopped' : paused ? 'paused' : 'running',
    failureCount,
    failures,
    tickIntervalMs,
  }));

  while (!stopped) {
    // A durable wait: if paused, this suspends the Workflow (no polling loop burning
    // resources) until a `resume` or `stop` signal flips the condition.
    await condition(() => !paused || stopped);
    if (stopped) break;

    const forceFail = failOnNextTick;
    failOnNextTick = false;

    try {
      await tick(forceFail);
      count++;
    } catch (err) {
      // `err` here is a Temporal ActivityFailure wrapper — the message that actually
      // matters (what activities.ts threw) is its root cause, not `err.message`.
      failureCount++;
      failures.push({
        atCount: count,
        message: rootCause(err) ?? 'Unknown failure',
        timestamp: Date.now(),
      });
      if (failures.length > MAX_FAILURES_KEPT) failures.shift();
    }

    await sleep(tickIntervalMs); // a durable timer, not setTimeout — survives Worker restarts too
  }

  return { count, status: 'stopped', failureCount, failures, tickIntervalMs };
}
