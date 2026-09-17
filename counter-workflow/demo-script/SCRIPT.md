Wwhat you're looking at is a counter. It counts up about once a second. It's deliberately boring, because the boring part isn't the point.

Let me start it. [click Start]

There we go. And every one of those numbers is a real Temporal Workflow taking a real step. So let me walk you through what's actually happening underneath, because there are eight moving pieces and this app uses all of them.

 The front end is just some HTML and it talks to a small Express serve. That server is what Temporal calls a Client. So when I click Start, the page hits my API, and my API turns around and tells Temporal, "hey, start the counter workflow, call it counter-demo." That's all a Client does. It starts things, sends messages, asks questions. It doesn't run any of the actual work.

The thing it's talking to is the Temporal Server — running over here in this other terminal, on port 7233. And this is the part that surprises people: the Server holds all the state. The current count, the full history of everything that's happened, any pending timers. But it never runs a single line of my code. It's the source of truth and the traffic controller, not the thing doing the work.

So who runs my code -- A Worker, it' s a separate Node process, and it's the only thing in this setup that actually executes what I wrote. It just sits there polling — "got anything for me? got anything for me?" And it's polling one specific named queue, the Task Queue. Mine's called counter-tasks. Server drops work on the queue, Worker picks it up.

Now, my code splits into two halves, and this is the part actually worth understanding.

The Workflow is the orchestration. It's the loop: do a tick, bump the count if it worked, wait a second, go again. And the count lives inside the Workflow — that's not a database I set up, it's just a variable. Temporal persists it for me. The catch is that Workflow code has to be deterministic. I can't call `Math.random()` , it can't hit an API, or can't use a normal `setTimeout`. It has to replay the same way every single time and be deterministic.

So anything non-deterministic goes in an Activity. I have a function called tick, and it's pretending to be a flaky third-party API — it fails roughly one time in five. And — [point at counter] — there, it just failed, and the count didn't reset. It logged it and kept going. Now, handling it that way was my choice. But the count surviving at all? That's Temporal.

That one-second gap between ticks is a Timer. Not `setTimeout` — a durable timer, owned by the Temporal Server. That's going to matter in about thirty seconds.

And these buttons — pause, resume, reset, trigger a failure — those are Signals. A Signal is just an async message you send into a Workflow that's already running, to change what it's doing. Watch. [click Pause] Paused. [click Resume] And it's going again. This is the mechanism for anything human-in-the-loop. Waiting on an approval, waiting for someone to click a link in an email. The Workflow just sits there, and a Signal wakes it up.

Alright. Here's the actual demo.

[click Crash Worker]

I just killed the Worker. And the count is frozen, because nothing is running my code anymore. That process is gone.

But the Server didn't lose anything. Still has the count, still has the history. And that one-second timer I mentioned is still ticking away on the Server side, completely unbothered.

[wait]

And… there. New Worker came up, started polling that same queue, picked up right where the old one left off. Same count. And this is the same Workflow Execution — it's not a retry, it's not a restart, it's the same run continuing.

That's really the whole pitch. My process died, and the work didn't die with it. And I didn't write anything to make that happen. No retry loop, no state table, no reconciliation job. I wrote a loop that counts.