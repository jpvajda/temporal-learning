// WORKFLOW DEFINITION = the function you write. Order of steps only. No HTTP, no axios, no clock.
// Like a voice-agent pipeline: "STT, then LLM, then TTS" — not the API calls themselves.
//
// Two exported functions = two Workflow Definitions. Each run is a Workflow Execution.
// Same Worker runs both. Start one with `npm run greeting`, the other with `npm run thanks`.
//
// `import type` is types-only. The real Activity code never loads in this file.
// proxyActivities builds stand-ins: calling them tells Temporal "run that Activity, wait."

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { getSpanishGreeting, getSpanishFarewell, getSpanishThanks } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds', // fail + retry if one Activity takes > 10s
  });

/** Workflow: hello, then goodbye. */
export async function greeting(name: string): Promise<string> {
  const greeting = await getSpanishGreeting(name);
  let farewell = "";
  farewell = await getSpanishFarewell(name);
  const helloGoodbye = "\n" + greeting + "\n" + farewell;
  return helloGoodbye;
}

/** Workflow: hello, then thanks. Reuses getSpanishGreeting — Activities are not owned by one Workflow. */
export async function thanks(name: string): Promise<string> {
  const greeting = await getSpanishGreeting(name);
  const gratitude = await getSpanishThanks(name);
  return "\n" + greeting + "\n" + gratitude;
}
