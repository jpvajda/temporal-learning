// Plain vanilla JS — no framework. This just polls GET /api/status once a second and
// re-renders the DOM, plus wires up buttons to POST the matching /api/* route in api.ts.
// Everything interesting (the counting, the failures, surviving a crash) happens in the
// Workflow on the Temporal Server — this file only displays it.

const POLL_MS = 1000;

const el = {
  count: document.getElementById('count'),
  workflowStatus: document.getElementById('workflow-status'),
  workerStatus: document.getElementById('worker-status'),
  failureLog: document.getElementById('failure-log'),
  connectionNote: document.getElementById('connection-note'),
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnResume: document.getElementById('btn-resume'),
  btnStop: document.getElementById('btn-stop'),
  btnReset: document.getElementById('btn-reset'),
  btnFailNow: document.getElementById('btn-fail-now'),
  btnCrashWorker: document.getElementById('btn-crash-worker'),
  btnStartWorker: document.getElementById('btn-start-worker'),
};

async function postJson(url) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${url} failed (${res.status})`);
  }
  return res.json();
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour12: false });
}

function renderFailures(failures) {
  el.failureLog.innerHTML = '';
  if (!failures || failures.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No failures yet.';
    el.failureLog.appendChild(li);
    return;
  }
  // newest first
  [...failures].reverse().forEach((f) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="fail-count">at count ${f.atCount}</span>
      <span>${f.message}</span>
      <span class="fail-time">${formatTime(f.timestamp)}</span>
    `;
    el.failureLog.appendChild(li);
  });
}

function renderNotStarted() {
  el.count.textContent = '—';
  el.workflowStatus.textContent = 'not started';
  el.workflowStatus.className = 'badge badge-unknown';
  setControlsEnabled({ start: true, pause: false, resume: false, stop: false, reset: false, failNow: false });
}

function renderState(state, reachable) {
  el.count.textContent = String(state.count);
  el.workflowStatus.textContent = reachable ? state.status : `${state.status} (worker unreachable)`;
  el.workflowStatus.className = `badge badge-${state.status}`;
  renderFailures(state.failures);

  const running = state.status === 'running';
  const paused = state.status === 'paused';
  const stopped = state.status === 'stopped';
  setControlsEnabled({
    start: stopped,
    pause: running,
    resume: paused,
    stop: !stopped,
    reset: true,
    failNow: !stopped,
  });
}

function setControlsEnabled({ start, pause, resume, stop, reset, failNow }) {
  el.btnStart.disabled = !start;
  el.btnPause.disabled = !pause;
  el.btnResume.disabled = !resume;
  el.btnStop.disabled = !stop;
  el.btnReset.disabled = !reset;
  el.btnFailNow.disabled = !failNow;
}

function renderWorker(worker) {
  if (!worker.managed) {
    // SKIP_WORKER_SPAWN=1 — some other terminal owns the Worker process, not this API.
    el.workerStatus.textContent =
      'Worker: externally managed (SKIP_WORKER_SPAWN=1) — use its own terminal to restart it.';
    el.workerStatus.classList.remove('down');
    el.btnCrashWorker.disabled = true;
    el.btnStartWorker.disabled = true;
  } else if (worker.alive) {
    el.workerStatus.textContent = `Worker: running (pid ${worker.pid})`;
    el.workerStatus.classList.remove('down');
    el.btnCrashWorker.disabled = false;
    el.btnStartWorker.disabled = true;
  } else if (worker.respawnEtaMs !== null) {
    const seconds = Math.ceil(worker.respawnEtaMs / 1000);
    el.workerStatus.textContent = `Worker: DOWN — auto-restarting in ~${seconds}s. Counter is frozen, nothing is lost.`;
    el.workerStatus.classList.add('down');
    el.btnCrashWorker.disabled = true;
    el.btnStartWorker.disabled = true;
  } else {
    el.workerStatus.textContent = 'Worker: not running.';
    el.workerStatus.classList.add('down');
    el.btnCrashWorker.disabled = true;
    el.btnStartWorker.disabled = false;
  }
}

async function poll() {
  try {
    const res = await fetch('/api/status');
    const body = await res.json();
    el.connectionNote.textContent = '';
    el.connectionNote.classList.remove('error');

    if (!body.started) {
      renderNotStarted();
    } else if (body.state) {
      renderState(body.state, body.reachable);
    }
    renderWorker(body.worker);
  } catch (err) {
    el.connectionNote.textContent = `Can't reach the API server: ${err.message}`;
    el.connectionNote.classList.add('error');
  }
}

function wireButton(button, action) {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await action();
    } catch (err) {
      el.connectionNote.textContent = err.message;
      el.connectionNote.classList.add('error');
    } finally {
      await poll();
    }
  });
}

wireButton(el.btnStart, () => postJson('/api/start'));
wireButton(el.btnPause, () => postJson('/api/pause'));
wireButton(el.btnResume, () => postJson('/api/resume'));
wireButton(el.btnStop, () => postJson('/api/stop'));
wireButton(el.btnReset, () => postJson('/api/reset'));
wireButton(el.btnFailNow, () => postJson('/api/fail-now'));
wireButton(el.btnCrashWorker, () => postJson('/api/worker/crash'));
wireButton(el.btnStartWorker, () => postJson('/api/worker/start'));

poll();
setInterval(poll, POLL_MS);
