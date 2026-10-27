// Task Recording: install the CW Task Recorder browser extension, and see the recordings sent from it.
// Everyone signed in can record; they see their own recordings, super admins (Miguel) see everyone's.

import Link from 'next/link';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { personById } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { listRecordings } from '@/lib/task-recordings/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Task Recording · CW AI Task Hub' };

const when = (at: number) => new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const STATUS = { uploading: 'Not sent yet', writing: 'Claude is writing', ready: 'Ready', error: 'Problem' } as const;

export default async function TaskRecordingsPage() {
  const user = await requireUser();
  const list = await listRecordings(user);
  const all = isSuperAdmin(user);

  return (
    <>
      <Header user={user} current="task-recordings" />
      <main className="page trec">
        <section className="hero">
          <span className="eyebrow">Task Recording</span>
          <h1>Record a task once, get the steps written for you</h1>
          <p>The CW Task Recorder browser extension takes a screenshot each time you click, type, copy, paste or switch tabs. When you stop, Claude writes a detailed step-by-step guide, a short summary and the Flow Canvas map, and Miguel is notified.</p>
        </section>

        <div className="trec-grid">
          <section className="card">
            <h2>Install the extension (Chrome or Edge)</h2>
            <ol className="trec-list">
              <li><a className="btn primary" href="/api/task-recordings/extension">Download the Task Recorder</a> and unzip it (double-click the file). Keep the <b>cw-task-recorder</b> folder somewhere safe, e.g. Documents.</li>
              <li>Open <b>chrome://extensions</b> (Edge: <b>edge://extensions</b>) in a new tab and turn on <b>Developer mode</b> (top right).</li>
              <li>Click <b>Load unpacked</b> and choose the <b>cw-task-recorder</b> folder.</li>
              <li>Click the puzzle icon in the toolbar and pin <b>CW Task Recorder</b>. Chrome asks to let it read the pages you visit: that's how it takes the screenshots.</li>
            </ol>
            <p className="muted small">Club Wealth internal only. To update, download it again and click the reload arrow on the extension’s card in chrome://extensions.</p>
          </section>

          <section className="card">
            <h2>Record a task</h2>
            <ol className="trec-list">
              <li>Click the Task Recorder button, allow screenshots the first time, then <b>Start recording</b>.</li>
              <li>After the <b>5-second countdown</b>, do the task as you normally would. Each click, tab switch, copy and paste is a step.</li>
              <li><b>Pause</b> for anything private (Alt+Shift+P), then resume. Passwords and card fields are always covered.</li>
              <li><b>Stop</b> (Alt+Shift+S). Review the screenshots, delete any you don't want, name the task and press <b>Send to Claude</b>.</li>
            </ol>
            <p className="muted small">Works best in Google Sheets, Slack, Keap and Eventbrite in the browser. Desktop apps outside the browser aren't recorded.</p>
          </section>
        </div>

        <section className="card">
          <h2>{all ? 'Everyone’s recordings' : 'Your recordings'}</h2>
          {list.length === 0 ? <p className="muted small">No recordings yet.</p> : (
            <div className="tw">
              <table className="sop-index">
                <thead><tr><th>Task</th>{all && <th>Recorded by</th>}<th>Steps</th><th>When</th><th>Status</th></tr></thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/task-recordings/${r.id}`}>{r.title}</Link></td>
                      {all && <td>{personById(r.owner)?.name ?? r.owner}</td>}
                      <td>{r.steps}</td>
                      <td>{when(r.at)}</td>
                      <td><span className={`pill ${r.status === 'ready' ? 'live' : r.status === 'error' ? 'req' : ''}`}>{STATUS[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
