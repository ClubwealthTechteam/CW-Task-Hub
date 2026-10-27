// CW Task Recorder: the part that runs in each page. While a recording is on, it reports each click, typed
// field, copy, cut and paste to the background (which takes the screenshot), with a plain description of what
// was clicked. In Google Sheets it adds the spreadsheet, the tab and the selected cell or range (Name Box).
// Passwords and card fields are never read: their text is "[hidden]" and they're covered in screenshots.
// It also shows the 5-second countdown before a recording starts.

(() => {
  if (window.__cwTaskRecorder) return;
  window.__cwTaskRecorder = true;

  const TOP = window === window.top;
  let status = 'idle';
  const send = (msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* extension reloaded */ } };

  chrome.storage.local.get('rec').then(({ rec }) => { status = rec?.status ?? 'idle'; });
  chrome.storage.onChanged.addListener((ch) => { if (ch.rec) status = ch.rec.newValue?.status ?? 'idle'; });
  const on = () => status === 'recording';

  // ---------- private fields ----------
  const PRIVATE = /card|cc-?num|cvv|cvc|security code|expir|password|passcode|\bssn\b|social security|routing|account number/i;
  function isPrivate(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches?.('input[type=password]')) return true;
    const ac = el.getAttribute?.('autocomplete') || '';
    if (/^cc-|new-password|current-password|one-time-code/.test(ac)) return true;
    const hint = [el.name, el.id, el.placeholder, el.getAttribute?.('aria-label')].filter(Boolean).join(' ');
    return el.matches?.('input, textarea') && PRIVATE.test(hint);
  }
  function privateRects() {
    if (!TOP) return [];
    const out = [];
    for (const el of document.querySelectorAll('input, textarea')) {
      if (!isPrivate(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) out.push({ x: r.left - 2, y: r.top - 2, w: r.width + 4, h: r.height + 4 });
    }
    return out;
  }

  // ---------- describing what was clicked ----------
  const clean = (s, max = 80) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const INTERACTIVE = 'a, button, [role=button], [role=link], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=tab], [role=option], [role=checkbox], [role=radio], [role=switch], [role=treeitem], [role=gridcell], summary, label, input, select, textarea, [contenteditable=""], [contenteditable=true]';
  const KIND = { a: 'link', button: 'button', select: 'dropdown', textarea: 'text box', summary: 'section', label: 'label' };

  function labelFor(el) {
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return clean(l.innerText); }
    return clean(el.getAttribute('aria-label') || el.closest('label')?.innerText || el.placeholder || el.name || el.title);
  }
  function describe(start) {
    const el = start.closest?.(INTERACTIVE) || start;
    const tag = el.tagName?.toLowerCase() || '';
    const role = el.getAttribute?.('role');
    let kind = role ? role.replace('menuitem', 'menu item').replace('gridcell', 'cell') : (KIND[tag] || '');
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      kind = { checkbox: 'checkbox', radio: 'option', submit: 'button', button: 'button', file: 'file picker', date: 'date field' }[t] || 'field';
      if (kind === 'button') return `button “${clean(el.value || el.getAttribute('aria-label'))}”`;
      return `${kind} “${labelFor(el) || t}”`;
    }
    if (tag === 'textarea' || el.isContentEditable) return `${kind || 'text box'} “${labelFor(el) || clean(el.getAttribute('data-placeholder')) || 'text'}”`;
    const text = clean(el.getAttribute?.('aria-label') || el.innerText || el.value || el.title || el.alt || el.querySelector?.('img[alt]')?.alt);
    if (!text && !kind) return clean(tag || 'page');
    return kind ? `${kind} “${text}”` : `“${text}”`;
  }

  // ---------- Google Sheets ----------
  const IS_SHEETS = /docs\.google\.com\/spreadsheets/.test(location.href);
  function sheetsInfo() {
    let d = document;
    try { d = window.top.document; } catch { /* cross-origin frame */ }
    if (!/docs\.google\.com\/spreadsheets/.test(d.location?.href || '')) return null;
    return {
      sheet: clean(d.title.replace(/\s*-\s*Google Sheets\s*$/i, ''), 200),
      tab: clean(d.querySelector('.docs-sheet-active-tab .docs-sheet-tab-name')?.textContent, 100),
      range: clean(d.querySelector('#t-name-box')?.value, 60),
    };
  }

  // ---------- clicks ----------
  document.addEventListener('pointerdown', (e) => {
    if (!on() || e.button !== 0 || !e.isTrusted) return;
    if (e.composedPath().some((n) => n?.id === 'cw-task-recorder-ui')) return;
    const t = e.target;
    const sheets = IS_SHEETS ? sheetsInfo() : null;
    const target = sheets && t?.tagName === 'CANVAS' ? 'the grid' : describe(t);
    send({
      type: 'event',
      event: {
        step: { kind: 'click', target, ...(sheets ? { sheet: sheets.sheet, tab: sheets.tab } : {}) },
        mark: { x: e.clientX, y: e.clientY },
        hide: privateRects(),
        vw: innerWidth,
      },
    });
  }, true);

  // Google Sheets selects the cell or range on mouse-up; report the Name Box then.
  if (IS_SHEETS) {
    document.addEventListener('pointerup', (e) => {
      if (!on() || e.button !== 0) return;
      setTimeout(() => {
        const s = sheetsInfo();
        if (s?.range) send({ type: 'patch', patch: { range: s.range, tab: s.tab, sheet: s.sheet } });
      }, 150);
    }, true);
  }

  // ---------- typing ----------
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!on() || !el?.matches?.('input, textarea, select')) return;
    const type = (el.type || '').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(type)) return; // the click already covers these
    const text = isPrivate(el) ? '[hidden]' : clean(el.tagName === 'SELECT' ? el.selectedOptions?.[0]?.text : el.value, 300);
    const r = el.getBoundingClientRect();
    send({ type: 'event', event: { step: { kind: 'type', target: describe(el), text }, mark: { x: r.left + Math.min(r.width / 2, 120), y: r.top + r.height / 2 }, hide: privateRects(), vw: innerWidth } });
  }, true);

  // Rich text boxes (Slack, Gmail, Keap notes) don't fire "change": report the text after a pause in typing.
  let typingTimer = null;
  document.addEventListener('input', (e) => {
    const el = e.target?.closest?.('[contenteditable=""], [contenteditable=true]');
    if (!on() || !el || IS_SHEETS) return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      const r = el.getBoundingClientRect();
      send({ type: 'event', event: { step: { kind: 'type', target: describe(el), text: clean(el.innerText, 300) }, mark: { x: r.left + Math.min(r.width / 2, 160), y: r.top + Math.min(r.height / 2, 20) }, hide: privateRects(), vw: innerWidth } });
    }, 1800);
  }, true);

  // ---------- copy / cut / paste ----------
  let lastClip = 0;
  function clip(kind) {
    if (!on() || Date.now() - lastClip < 600) return;
    lastClip = Date.now();
    const s = sheetsInfo();
    const active = document.activeElement;
    const target = s?.range ? `cells ${s.range}` : (active && active !== document.body ? describe(active) : clean(getSelection()?.toString(), 60) || 'the selection');
    send({ type: 'event', event: { step: { kind, target, ...(s ? { sheet: s.sheet, tab: s.tab, range: s.range } : {}) }, hide: privateRects(), vw: innerWidth, noShot: !TOP && !s } });
  }
  for (const kind of ['copy', 'cut', 'paste']) document.addEventListener(kind, () => clip(kind), true);
  // Google Sheets handles the keys in a hidden frame, where the copy event doesn't always reach us.
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'c') clip('copy'); else if (k === 'x') clip('cut'); else if (k === 'v') clip('paste');
  }, true);

  // ---------- messages from the background ----------
  if (!TOP) return;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'ping') { reply({ ok: true }); return; }
    if (msg?.type === 'page-info') { reply({ hide: privateRects(), vw: innerWidth }); return; }
    if (msg?.type === 'countdown') countdown(msg.seconds || 5);
  });

  function countdown(seconds) {
    document.getElementById('cw-task-recorder-ui')?.remove();
    const host = document.createElement('div');
    host.id = 'cw-task-recorder-ui';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .wrap{position:fixed;inset:0;display:grid;place-items:center;background:rgba(11,27,61,.45);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .card{background:#fff;border-radius:18px;padding:26px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      .n{font-size:84px;font-weight:800;color:#ff7a00;line-height:1}
      .t{margin-top:10px;font-size:15px;color:#1b2a4a;font-weight:600}
      .s{margin-top:4px;font-size:12.5px;color:#5f6b7a}
    </style><div class="wrap"><div class="card"><div class="n">${seconds}</div><div class="t">Task recording starts in…</div><div class="s">Each click and tab switch becomes a screenshot. Stop it from the extension’s toolbar button.</div></div></div>`;
    document.documentElement.appendChild(host);
    const n = root.querySelector('.n');
    let left = seconds;
    const timer = setInterval(() => {
      left -= 1;
      if (left > 0) { n.textContent = String(left); return; }
      clearInterval(timer);
      host.remove();
    }, 1000);
  }
})();
