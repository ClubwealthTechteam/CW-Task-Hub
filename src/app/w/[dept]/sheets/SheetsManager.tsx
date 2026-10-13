'use client';

import { useState } from 'react';
import type { SheetEntry } from '@/lib/sheets';

type Sheet = SheetEntry & { ownerName: string; access?: 'ok' | 'not_shared' };
interface Task { id: string; title: string; owner: string | null }
interface Approved { email: string; note?: string }

interface Props {
  admin: boolean;
  deptName: string;
  mainAccount: string;
  robotEmail: string | null;
  approved: Approved[];
  tasks: Task[];
  initial: Sheet[];
  preselect?: string;
}

export function SheetsManager({ admin, deptName, mainAccount, robotEmail, approved: approvedInit, tasks, initial, preselect }: Props) {
  const [sheets, setSheets] = useState(initial);
  const [approved, setApproved] = useState(approvedInit);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [account, setAccount] = useState(mainAccount);
  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newNote, setNewNote] = useState('');
  const [approveMsg, setApproveMsg] = useState('');

  const taskTitle = (id: string) => tasks.find((t) => t.id === id)?.title ?? id;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch('/api/sheets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, account, taskIds: picked, note }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setSheets((s) => [{ ...body.sheet, ownerName: 'You' }, ...s]);
      setName(''); setUrl(''); setNote(''); setPicked(preselect ? [preselect] : []); setAccount(mainAccount);
      setMsg({ ok: true, text: 'Spreadsheet added.' });
    } else setMsg({ ok: false, text: body.error || 'Something went wrong' });
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/sheets/${id}`, { method: 'DELETE' });
    setConfirm(null);
    if (res.ok) setSheets((s) => s.filter((x) => x.id !== id));
  }

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    setApproveMsg('');
    const res = await fetch('/api/sheets/approved', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, note: newNote }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setApproved((a) => [...a, { email: body.approved.email, note: body.approved.note }]); setNewEmail(''); setNewNote(''); }
    else setApproveMsg(body.error || 'Something went wrong');
  }

  async function unapprove(email: string) {
    const res = await fetch(`/api/sheets/approved?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    if (res.ok) setApproved((a) => a.filter((x) => x.email !== email));
  }

  return (
    <main className="ws-page">
      <div className="ws-page-h">
        <h1>{admin ? `${deptName} spreadsheets` : 'My spreadsheets'}</h1>
        <p>List every spreadsheet you use for your tasks so the hub can connect them. Spreadsheets need to be in the marketing Gmail, <b>{mainAccount}</b>, or another account Miguel has approved.</p>
        {robotEmail && (
          <p className="share-hint">So the assistant can read a sheet, open it in Google Sheets → <b>Share</b> → add <code>{robotEmail}</code> as <b>Viewer</b>. <button className="linkish" onClick={() => navigator.clipboard?.writeText(robotEmail).catch(() => undefined)}>Copy email</button></p>
        )}
      </div>

      <section className="card">
        <h2>Add a spreadsheet</h2>
        <form className="sheet-form" onSubmit={add}>
          <div className="field">
            <label htmlFor="sh-name">Name</label>
            <input id="sh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Half-Day Attendance Tracker" maxLength={120} required />
          </div>
          <div className="field">
            <label htmlFor="sh-url">Google Sheets link</label>
            <input id="sh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" required />
          </div>
          <div className="field">
            <label htmlFor="sh-acct">Which account is it in?</label>
            <select id="sh-acct" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value={mainAccount}>Marketing Gmail ({mainAccount})</option>
              {approved.map((a) => <option key={a.email} value={a.email}>{a.email}{a.note ? ` (${a.note})` : ''}</option>)}
            </select>
            <small className="muted">Not in the list? Move or share the sheet to the marketing Gmail, or ask Miguel to approve the account.</small>
          </div>
          <div className="field">
            <label htmlFor="sh-note">Notes <span className="muted">(optional)</span></label>
            <input id="sh-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Which tab, what it's for, who updates it" maxLength={500} />
          </div>
          {tasks.length > 0 && (
            <fieldset className="field sheet-tasks">
              <legend>Used for which tasks? <span className="muted">(optional)</span></legend>
              <div className="sheet-task-list">
                {tasks.map((t) => (
                  <label key={t.id} className="check">
                    <input type="checkbox" checked={picked.includes(t.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} />
                    <span>{t.title}{t.owner && <small className="muted"> · {t.owner}</small>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="row">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add spreadsheet'}</button>
            {msg && <span role="status" className={msg.ok ? 'ok-text' : 'note'}>{msg.text}</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>{admin ? 'Spreadsheets in this department' : 'Your spreadsheets'} <span className="muted small">({sheets.length})</span></h2>
        {sheets.length === 0 ? <p className="muted small" style={{ margin: 0 }}>None yet. Add the first one above.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Spreadsheet</th><th>Account</th><th>Tasks</th>{admin && <th>Added by</th>}<th aria-label="Actions" /></tr></thead>
              <tbody>
                {sheets.map((s) => (
                  <tr key={s.id}>
                    <td><a href={s.url} target="_blank" rel="noreferrer"><b>{s.name}</b></a>{s.note && <div className="muted small">{s.note}</div>}</td>
                    <td className="small">{s.account}{s.access === 'ok' && <div className="acc ok">✓ Hub can read it</div>}{s.access === 'not_shared' && <div className="acc no">Not shared with the hub yet</div>}</td>
                    <td className="small">{s.taskIds.length ? s.taskIds.map(taskTitle).join(', ') : <span className="muted">—</span>}</td>
                    {admin && <td className="small">{s.ownerName}</td>}
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {confirm === s.id ? (
                        <span className="row" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn danger" onClick={() => remove(s.id)}>Remove</button>
                          <button className="btn" onClick={() => setConfirm(null)}>Keep</button>
                        </span>
                      ) : <button className="btn" onClick={() => setConfirm(s.id)}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {admin && (
        <section className="card">
          <h2>Approved accounts</h2>
          <p className="muted small" style={{ margin: 0 }}>The marketing Gmail ({mainAccount}) is always allowed. Approve any other Google account here before people can add sheets from it.</p>
          {approved.length > 0 && (
            <ul className="approved-list">
              {approved.map((a) => (
                <li key={a.email}><span><b>{a.email}</b>{a.note && <span className="muted"> · {a.note}</span>}</span><button className="btn" onClick={() => unapprove(a.email)}>Remove</button></li>
              ))}
            </ul>
          )}
          <form className="row" onSubmit={approve}>
            <input aria-label="Account email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="account@example.com" style={{ maxWidth: 280 }} required />
            <input aria-label="Note" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Why (optional)" style={{ maxWidth: 240 }} />
            <button className="btn primary" type="submit">Approve account</button>
            {approveMsg && <span className="note">{approveMsg}</span>}
          </form>
        </section>
      )}
    </main>
  );
}
