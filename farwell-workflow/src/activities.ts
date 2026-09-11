// ACTIVITY = one side-effect step. HTTP / DB / APIs live here.
// Like "call Deepgram STT" or "call the LLM" — one vendor call per function.
//
// Temporal retries these if they throw (API down, timeout). The Workflow does not re-run
// steps that already succeeded.
//
// This file is not a process. The Worker (worker.ts) imports it and runs the functions.

import axios from 'axios';

const url = 'http://localhost:9999'; // fake API in service.ts — not Temporal

/** Activity: GET /get-spanish-greeting. Used by both `greeting` and `thanks` Workflows. */
export async function getSpanishGreeting(name: string): Promise<string> {
  const response = await axios.get(`${url}/get-spanish-greeting?name=${name}`);

  return response.data;
}

/** Activity: GET /get-spanish-farewell. Used only by the `greeting` Workflow. */
export async function getSpanishFarewell(name: string): Promise<string> {
  const response = await axios.get(`${url}/get-spanish-farewell?name=${name}`);

  return response.data;
}

/** Activity: GET /get-spanish-thanks. Used only by the `thanks` Workflow. */
export async function getSpanishThanks(name: string): Promise<string> {
  const response = await axios.get(`${url}/get-spanish-thanks?name=${name}`);

  return response.data;
}
