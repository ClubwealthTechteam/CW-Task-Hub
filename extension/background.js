// CW Task Recorder: the background part. It keeps the recording (state + steps in chrome.storage.local,
// so nothing is lost when Chrome puts this worker to sleep), takes a screenshot of the visible tab for every
// click, typed field, copy/paste and tab switch, circles where the click was, hides private fields, and
// opens the review page when the recording stops. Nothing leaves this computer until the person presses
// "Send to Claude" on the review page.

const COUNTDOWN = 5;              // seconds before the recording starts
const SHOT_WIDTH = 1000;          // screenshots are saved this wide (px), WebP
const SHOT_QUALITY = 0.72;
const MIN_GAP = 550;              // Chrome allows about 2 screenshots a second
const MAX_STEPS = 150;

const ORANGE = '#ff7a00';

// ---------- state ----------
// rec: { status: 'idle' | 'countdown' | 'recording' | 'paused', startedAt, steps: [...] }
// shots: chrome.storage.local "shot:<id>" = data URL, where id is the step's own id (not its position).
async function getRec() {
  const { rec } = await chrome.storage.local.get('rec');
  return rec ?? { status: 'idle', steps: [] };
}
async function setRec(rec) {
  await chrome.storage.local.set({ rec });
  await badge(rec);
}

// Every change to the recording goes through this queue, so two quick clicks can't overwrite each other.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn).catch((e) => console.warn('Task Recorder:', e)));

async function badge(rec) {
  const map = { idle: ['', '#0b1b3d'], countdown: ['', ORANGE], recording: ['REC', '#d93025'], paused: ['||', '#5f6368'] };
  const [text, color] = map[rec.status] ?? map.idle;
  await chrome.action.setBadgeBackgroundColor({ color });
  if (rec.status !== 'countdown') await chrome.action.setBadgeText({ text });
}

// ---------- screenshots ----------
let lastCapture = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Screenshot of the visible tab. `mark` = { x, y } in CSS pixels to circle; `hide` = rects (CSS pixels)
 * of private fields to cover; `vw` = the page's viewport width in CSS pixels (to scale both).
 */
async function capture(windowId, { mark, hide = [], vw } = {}) {
  const wait = lastCapture + MIN_GAP - Date.now();
  if (wait > 0) await sleep(wait);
  lastCapture = Date.now();
  let url;
  try {
    url = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 92 });
  } catch {
    return null; // chrome:// pages, the Web Store and PDFs in some setups can't be captured
  }
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const k = vw ? bmp.width / vw : 1; // CSS px → screenshot px
  const full = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = full.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  for (const r of hide) {
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(r.x * k, r.y * k, r.w * k, r.h * k);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(11, Math.min(r.h * k * 0.5, 18 * k))}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('Hidden', r.x * k + 6 * k, (r.y + r.h / 2) * k);
  }
  if (mark) {
    const x = mark.x * k, y = mark.y * k, r = 26 * k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,122,0,0.18)'; ctx.fill();
    ctx.lineWidth = 5 * k; ctx.strokeStyle = ORANGE; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 4 * k, 0, Math.PI * 2); ctx.fillStyle = ORANGE; ctx.fill();
  }
  const w = Math.min(SHOT_WIDTH, bmp.width), h = Math.round(bmp.height * (w / bmp.width));
  const out = new OffscreenCanvas(w, h);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(full, 0, 0, w, h);
  const blob = await out.convertToBlob({ type: 'image/webp', quality: SHOT_QUALITY });
  return `data:image/webp;base64,${toBase64(await blob.arrayBuffer())}`;
}

/** Asks the page for its private-field rects and viewport width (top frame only); empty if it can't answer. */
async function pageInfo(tabId) {
  try {
    const res = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: 'page-info' }, { frameId: 0 }),
      sleep(400).then(() => null),
    ]);
    return res ?? { hide: [], vw: 0 };
  } catch {
    return { hide: [], vw: 0 };
  }
}

/** Makes sure the recorder's page script runs in a tab opened before the extension was installed. */
async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ping' }, { frameId: 0 });
  } catch {
    try { await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] }); } catch { /* chrome:// etc. */ }
  }
}

// ---------- steps ----------
const stepId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Adds a step (with a screenshot unless `noShot`). Ignored unless recording. */
function addStep(tab, data, shotOpts, noShot = false) {
  return serial(async () => {
    const rec = await getRec();
    if (rec.status !== 'recording' || rec.steps.length >= MAX_STEPS) return;
    const id = stepId();
    const shot = noShot ? null : await capture(tab.windowId, shotOpts);
    const step = { id, at: Date.now(), url: tab.url ?? '', title: tab.title ?? '', ...data, hasShot: Boolean(shot), tabId: tab.id };
    if (shot) await chrome.storage.local.set({ [`shot:${id}`]: shot });
    const fresh = await getRec(); // re-read: a Stop may have happened while the screenshot was taken
    if (fresh.status !== 'recording') { if (shot) await chrome.storage.local.remove(`shot:${id}`); return; }
    fresh.steps.push(step);
    await setRec(fresh);
    chrome.runtime.sendMessage({ type: 'steps', count: fresh.steps.length }).catch(() => {});
  });
}

/** Adds the Google Sheets range to the newest step from that tab (the Name Box updates after the click). */
function patchLast(tabId, patch) {
  return serial(async () => {
    const rec = await getRec();
    const last = [...rec.steps].reverse().find((s) => s.tabId === tabId);
    if (!last || Date.now() - last.at > 4000) return;
    Object.assign(last, patch);
    await setRec(rec);
  });
}

// ---------- start / pause / stop ----------
let countdownTimer = null;

async function start() {
  const rec = await getRec();
  if (rec.status !== 'idle') return;
  // A recording that was stopped but not sent yet stays until it's sent or discarded on the review page.
  const { pending } = await chrome.storage.local.get('pending');
  if (pending) { await openReview(); return; }
  await setRec({ status: 'countdown', startedAt: Date.now(), steps: [] });
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) {
    await ensureContent(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: 'countdown', seconds: COUNTDOWN }, { frameId: 0 }).catch(() => {});
  }
  let left = COUNTDOWN;
  await chrome.action.setBadgeText({ text: String(left) });
  clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    left -= 1;
    if (left > 0) { chrome.action.setBadgeText({ text: String(left) }); return; }
    clearInterval(countdownTimer);
    const r = await getRec();
    if (r.status !== 'countdown') return;
    await setRec({ ...r, status: 'recording' });
    await sleep(250); // let the countdown overlay disappear before the first screenshot
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (t) {
      const info = t.id ? await pageInfo(t.id) : { hide: [], vw: 0 };
      await addStep(t, { kind: 'start' }, { hide: info.hide, vw: info.vw });
    }
  }, 1000);
}

async function togglePause() {
  await serial(async () => {
    const rec = await getRec();
    if (rec.status === 'recording') await setRec({ ...rec, status: 'paused' });
    else if (rec.status === 'paused') await setRec({ ...rec, status: 'recording' });
  });
  const rec = await getRec();
  broadcast({ type: 'state', status: rec.status });
}

async function stop() {
  clearInterval(countdownTimer);
  await serial(async () => {
    const rec = await getRec();
    if (rec.status === 'idle') return;
    // The finished recording waits on the review page; the recorder is free for the next one only after it's sent or discarded.
    await chrome.storage.local.set({ pending: { startedAt: rec.startedAt, stoppedAt: Date.now(), steps: rec.steps } });
    await setRec({ status: 'idle', steps: [] });
  });
  broadcast({ type: 'state', status: 'idle' });
  const { pending } = await chrome.storage.local.get('pending');
  if (pending?.steps?.length) await openReview();
  else await chrome.storage.local.remove('pending');
}

async function openReview() {
  const url = chrome.runtime.getURL('review.html');
  const [open] = await chrome.tabs.query({ url });
  if (open?.id) await chrome.tabs.update(open.id, { active: true });
  else await chrome.tabs.create({ url });
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// ---------- events from pages ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tab = sender.tab;
  switch (msg?.type) {
    case 'get-state':
      getRec().then((rec) => chrome.storage.local.get('pending').then(({ pending }) => reply({ status: rec.status, steps: rec.steps.length, pending: Boolean(pending) })));
      return true;
    case 'start': start().then(() => reply({ ok: true })); return true;
    case 'pause': togglePause().then(() => reply({ ok: true })); return true;
    case 'stop': stop().then(() => reply({ ok: true })); return true;
    case 'review': openReview().then(() => reply({ ok: true })); return true;
    case 'event': {
      if (!tab?.id) return;
      // Clicks inside frames can't be placed on the screenshot, so only top-frame clicks get the circle.
      const top = sender.frameId === 0;
      const e = msg.event;
      addStep(tab, e.step, { mark: top && e.mark ? e.mark : null, hide: e.hide ?? [], vw: e.vw }, e.noShot);
      return;
    }
    case 'patch': if (tab?.id) patchLast(tab.id, msg.patch); return;
  }
});

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'toggle-pause') togglePause();
  if (cmd === 'stop-recording') stop();
});

// ---------- tab switches and pages opened ----------
const lastUrl = new Map(); // tabId → origin + path last seen
const place = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return u || ''; } };
/** Only real web pages count as steps (not blank tabs, chrome:// pages or this extension's own pages). */
const webPage = (u) => /^(https?|file):/.test(u || '');

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const rec = await getRec();
  if (rec.status !== 'recording') return;
  await sleep(350);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !webPage(tab.url)) return;
  await ensureContent(tabId);
  const info = await pageInfo(tabId);
  lastUrl.set(tabId, place(tab.url));
  addStep(tab, { kind: 'tab' }, { hide: info.hide, vw: info.vw });
});

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete' || !tab.active) return;
  const rec = await getRec();
  if (rec.status !== 'recording' || !webPage(tab.url)) return;
  const now = place(tab.url);
  if (lastUrl.get(tabId) === now) return;
  lastUrl.set(tabId, now);
  await ensureContent(tabId);
  const info = await pageInfo(tabId);
  addStep(tab, { kind: 'page' }, { hide: info.hide, vw: info.vw });
});

chrome.tabs.onRemoved.addListener((tabId) => lastUrl.delete(tabId));

// After a browser restart, a recording that was running is paused (the countdown can't resume).
chrome.runtime.onStartup.addListener(async () => {
  const rec = await getRec();
  if (rec.status === 'recording') await setRec({ ...rec, status: 'paused' });
  else if (rec.status === 'countdown') await setRec({ status: 'idle', steps: [] });
  else await badge(rec);
});
chrome.runtime.onInstalled.addListener(async () => badge(await getRec()));
