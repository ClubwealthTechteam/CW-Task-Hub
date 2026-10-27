// CW Task Recorder review page: shows every recorded step with its screenshot, lets the person delete steps
// and name the task, then sends it to the Admin Hub (steps first, then each screenshot) and asks Claude to
// write it up. The recording stays on this computer until it's sent (or discarded).

import { HUB_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const LABEL = { start: 'Start', click: 'Click', tab: 'Switched tab', page: 'Opened page', type: 'Typed', copy: 'Copied', cut: 'Cut', paste: 'Pasted' };
let pending = null;
let recordingId = null;

function status(text, kind = '') {
  const el = $('status');
  el.hidden = !text;
  el.className = `status ${kind}`;
  el.textContent = text;
}

async function load() {
  ({ pending } = await chrome.storage.local.get('pending'));
  const { sent } = await chrome.storage.local.get('sent');
  if (!pending) {
    $('form').hidden = !sent;
    if (sent) showDone(sent.id);
    $('steps').innerHTML = sent ? '' : '<p class="hint">No recording to review. Start one from the Task Recorder button in the toolbar.</p>';
    return;
  }
  const when = new Date(pending.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  $('sub').textContent = `${pending.steps.length} steps · recorded ${when}`;
  await draw();
}

async function draw() {
  const box = $('steps');
  box.innerHTML = '';
  const keys = pending.steps.filter((s) => s.hasShot).map((s) => `shot:${s.id}`);
  const shots = keys.length ? await chrome.storage.local.get(keys) : {};
  pending.steps.forEach((s, i) => {
    const card = document.createElement('article');
    card.className = 'step';
    const src = shots[`shot:${s.id}`];
    if (src) {
      const img = Object.assign(document.createElement('img'), { src, alt: `Step ${i + 1} screenshot`, loading: 'lazy' });
      img.onclick = () => zoom(src);
      card.append(img);
    } else card.append(Object.assign(document.createElement('div'), { className: 'noimg', textContent: 'No screenshot for this step' }));
    const meta = document.createElement('div');
    meta.className = 'meta';
    const head = document.createElement('b');
    head.textContent = `${i + 1}. ${LABEL[s.kind] || s.kind}${s.target ? ` ${s.target}` : ''}`;
    meta.append(head);
    const extra = [s.text && `“${s.text}”`, s.range && `${s.tab ? `${s.tab} · ` : ''}${s.range}`].filter(Boolean).join(' · ');
    if (extra) meta.append(Object.assign(document.createElement('span'), { textContent: extra }));
    meta.append(Object.assign(document.createElement('small'), { textContent: s.title || s.url }));
    card.append(meta);
    const del = Object.assign(document.createElement('button'), { className: 'btn del', type: 'button', textContent: 'Delete step' });
    del.onclick = async () => {
      pending.steps = pending.steps.filter((x) => x.id !== s.id);
      await chrome.storage.local.remove(`shot:${s.id}`);
      await chrome.storage.local.set({ pending });
      $('sub').textContent = `${pending.steps.length} steps`;
      draw();
    };
    card.append(del);
    box.append(card);
  });
}

function zoom(src) {
  const z = document.createElement('div');
  z.className = 'zoom';
  z.append(Object.assign(document.createElement('img'), { src, alt: 'Screenshot' }));
  z.onclick = () => z.remove();
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { z.remove(); document.removeEventListener('keydown', esc); } });
  document.body.append(z);
}

async function hub(path, init = {}) {
  const res = await fetch(`${HUB_URL}${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('signin');
  if (!res.ok) throw new Error(data.error || `The Admin Hub answered ${res.status}`);
  return data;
}

$('send').onclick = async () => {
  if (!pending?.steps.length) return status('There are no steps to send.', 'err');
  $('send').disabled = $('discard').disabled = true;
  try {
    const steps = pending.steps.map(({ id, tabId, ...rest }) => rest);
    status('Sending the steps to the Admin Hub…');
    const { id } = await hub('/api/task-recordings', { method: 'POST', body: JSON.stringify({ title: $('title').value, about: $('about').value, steps }) });
    recordingId = id;
    const withShots = pending.steps.map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.hasShot);
    for (const [k, { s, n }] of withShots.entries()) {
      status(`Uploading screenshots… ${k + 1} of ${withShots.length}`);
      const key = `shot:${s.id}`;
      const dataUrl = (await chrome.storage.local.get(key))[key];
      if (dataUrl) await hub(`/api/task-recordings/${id}/shots/${n}`, { method: 'PUT', body: JSON.stringify({ dataUrl }) });
    }
    status('Claude is reading your steps and writing them up. This takes up to a few minutes; keep this page open…');
    const res = await hub(`/api/task-recordings/${id}/write`, { method: 'POST' });
    await chrome.storage.local.remove([...pending.steps.map((s) => `shot:${s.id}`), 'pending']);
    await chrome.storage.local.set({ sent: { id, at: Date.now() } });
    pending = null;
    $('steps').innerHTML = '';
    status(res.problem
      ? `Sent. ${res.problem}, so a basic write-up was made from the steps instead. Miguel can run Claude again from the Admin Hub.`
      : 'Sent! Claude wrote the steps and the summary, and Miguel was notified.', res.problem ? '' : 'ok');
    showDone(id);
  } catch (e) {
    $('send').disabled = $('discard').disabled = false;
    if (e.message === 'signin') {
      status('', '');
      const el = $('status');
      el.hidden = false; el.className = 'status err';
      el.append('You’re not signed in to the Admin Hub. ', Object.assign(document.createElement('a'), { href: `${HUB_URL}/login`, target: '_blank', textContent: 'Sign in' }), ', then press Send to Claude again.');
    } else status(`Couldn’t send it: ${e.message}. Your recording is still here; try again.`, 'err');
  }
};

function showDone(id) {
  recordingId = id;
  $('send').hidden = $('discard').hidden = true;
  $('done').hidden = false;
  $('open').href = `${HUB_URL}/task-recordings/${id}`;
}

$('copy').onclick = async () => {
  try {
    const res = await fetch(`${HUB_URL}/api/task-recordings/${recordingId}/flow`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    await navigator.clipboard.writeText(await res.text());
    status('Flow Canvas JSON copied. Paste it in the CW AI Hub canvas with Paste JSON, or send it to Miguel.', 'ok');
  } catch {
    status('Couldn’t copy it here. Open it in the Admin Hub and use Copy JSON there.', 'err');
  }
};

$('clear').onclick = async () => { await chrome.storage.local.remove('sent'); window.close(); };

$('discard').onclick = async () => {
  if ($('discard').dataset.sure !== '1') { $('discard').dataset.sure = '1'; $('discard').textContent = 'Click again to discard'; return; }
  await chrome.storage.local.remove([...pending.steps.map((s) => `shot:${s.id}`), 'pending']);
  window.close();
};

load();
