// Task Recording: record a task by screen sharing (no download), and see the recordings sent.
// Everyone signed in can record; they see their own recordings, super admins (Miguel) see everyone's.

import Link from 'next/link';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { personById } from '@/config/people';
import { isSuperAdmin } from '@/lib/access';
import { listRecordings } from '@/lib/task-recordings/store';
import { WebRecorder } from '@/components/task-recordings/WebRecorder';

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
          <p>Share your screen, do the task once, and stop. Claude writes a detailed step-by-step guide, a short summary and the Flow Canvas map, and Miguel is notified. Nothing to install.</p>
        </section>

        <section className="card">
          <h2>Record a task</h2>
          <p className="muted small">Works like Loom’s web recorder, with screenshots instead of video. Claude works out each click from the screenshots. Sharing your entire screen also records desktop apps.</p>
          <WebRecorder />
        </section>

        <section className="card">
          <h2>How it works</h2>
          <ol className="trec-list">
            <li>Click <b>Start recording</b>. Your browser asks what to share: pick <b>Entire screen</b> (or a whole window) for a task across several tabs or apps, or just the tab you'll work in.</li>
            <li>After the <b>5-second countdown</b>, switch to your task and do it as you normally would. A screenshot is saved each time the screen changes.</li>
            <li><b>Pause</b> before typing a password or opening anything private, then resume.</li>
            <li>Come back to this tab and press <b>Stop</b>. Delete any screenshot you don't want sent, name the task and press <b>Send to Claude</b>. Claude writes the steps, a summary and the Flow Canvas map, and Miguel is notified.</li>
          </ol>
          <p className="muted small">Nothing to install. Works in Chrome and Edge. Keep this tab open while you record: the screenshots stay here until you send them.</p>
        </section>

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
