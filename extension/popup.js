// CW Task Recorder popup: asks for consent once, shows who's signed in to the Admin Hub, and starts,
// pauses and stops the recording (the background does the recording itself).

import { HUB_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const ask = (type) => chrome.runtime.sendMessage({ type });

async function who() {
  try {
    const res = await fetch(`${HUB_URL}/api/task-recordings`, { credentials: 'include' });
    if (res.ok) { const d = await res.json(); $('who').textContent = `Signed in to the Admin Hub as ${d.user.name}`; return; }
  } catch { /* offline or hub down */ }
  $('who').innerHTML = '';
  const a = Object.assign(document.createElement('a'), { href: `${HUB_URL}/login`, target: '_blank', textContent: 'Sign in to the Admin Hub' });
  $('who').append('Not signed in. ', a, ' to send recordings.');
  $('who').classList.add('warn');
}

async function render() {
  const { consent } = await chrome.storage.local.get('consent');
  $('consent').hidden = Boolean(consent);
  $('main').hidden = !consent;
  if (!consent) return;
  const s = await ask('get-state');
  const live = s.status === 'recording' || s.status === 'paused' || s.status === 'countdown';
  $('idle').hidden = live || s.pending;
  $('pending').hidden = live || !s.pending;
  $('live').hidden = !live;
  $('count').textContent = String(s.steps);
  $('state').textContent = { recording: 'Recording', paused: 'Paused', countdown: 'Starting…' }[s.status] || '';
  $('pause').textContent = s.status === 'paused' ? 'Resume' : 'Pause';
  $('pause').disabled = s.status === 'countdown';
  document.body.dataset.state = s.status;
}

$('agree').onclick = async () => { await chrome.storage.local.set({ consent: { at: Date.now() } }); render(); };
$('start').onclick = async () => { await ask('start'); render(); setTimeout(() => window.close(), 600); };
$('pause').onclick = async () => { await ask('pause'); render(); };
$('stop').onclick = async () => { await ask('stop'); window.close(); };
$('review').onclick = async () => { await ask('review'); window.close(); };

chrome.runtime.onMessage.addListener((m) => { if (m.type === 'steps' || m.type === 'state') render(); });
render();
who();
