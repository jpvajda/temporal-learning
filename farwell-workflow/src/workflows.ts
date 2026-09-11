import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { getSpanishGreeting, getSpanishFarewell, getSpanishThanks } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 seconds',
  });

export async function greeting(name: string): Promise<string> {
  const greeting = await getSpanishGreeting(name);
  let farewell = "";
  farewell = await getSpanishFarewell(name);
  const helloGoodbye = "\n" + greeting + "\n" + farewell;
  return helloGoodbye;
}

export async function thanks(name: string): Promise<string> {
  const greeting = await getSpanishGreeting(name);
  const gratitude = await getSpanishThanks(name);
  return "\n" + greeting + "\n" + gratitude;
}