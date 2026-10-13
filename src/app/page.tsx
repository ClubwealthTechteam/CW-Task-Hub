import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { StagePill } from '@/components/Bits';
import { Icon } from '@/components/Icon';
import { requireUser, getViewer } from '@/lib/auth/current-user';
import { visibleDepartments, isSuperAdmin } from '@/lib/access';
import { allAutomations } from '@/data/catalog';
import { PEOPLE } from '@/config/people';
import { DEPARTMENTS } from '@/config/departments';
import { announcementsFor, toView } from '@/lib/announcements';
import { Announcements } from '@/components/Announcements';
import { DeptOverview, stageCounts } from '@/components/DeptOverview';
import { ActivityChart } from '@/components/dash/ActivityChart';
import { ActivityTable } from '@/components/dash/ActivityTable';
import { Gauge } from '@/components/dash/Gauge';
import { dashboardData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

const shortDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });

function Change({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  if (!before) return <span className="dchg up">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  return <span className={`dchg ${pct >= 0 ? 'up' : 'down'}`}>{pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%</span>;
}

export default async function Home() {
  const user = await requireUser();
  // Team members go straight to their department workspace; this dashboard is for super admins.
  if (!isSuperAdmin(user)) redirect(`/w/${user.departments[0]}`);
  const depts = visibleDepartments(user);
  // Read everything at the same time rather than one after another.
  const [all, announcements, viewer] = await Promise.all([allAutomations(), announcementsFor(user), getViewer()]);
  const dash = await dashboardData(all);
  const mine = all.filter((a) => a.ownerId === user.id);
  const first = user.name.split(' ')[0];
  const updates = announcements.map(toView);
  const preview = Boolean(viewer?.preview);
  const counts = stageCounts(all.filter((a) => depts.some((d) => d.id === a.department)));
  const pct = counts.total ? Math.round((counts.live / counts.total) * 100) : 0;
  const c = dash.council;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

  return (
    <>
      <Header user={user} current="home" />
      <main className="page dash">
        <div className="dhead">
          <div>
            <h1>Overview</h1>
            <p className="muted">Hi {first}. Here’s the hub at a glance · {today}</p>
          </div>
          <div className="row">
            <Link href="/updates" className="dbtn">Updates</Link>
            <Link href="/council" className="dbtn primary">Open the Council</Link>
          </div>
        </div>

        <section className="dkpis" aria-label="Key numbers">
          <div className="dkpi hi">
            <div className="dkpi-top"><span>Live automations</span><span className="dico"><Icon name="spark" size={18} /></span></div>
            <b>{counts.live}</b>
            <small>of {counts.total} · {counts.building} in progress</small>
          </div>
          <div className="dkpi">
            <div className="dkpi-top"><span>Assistant questions</span><span className="dico dark"><Icon name="chat" size={18} /></span></div>
            <div className="dkpi-n"><b>{dash.thisWeek}</b><Change now={dash.thisWeek} before={dash.lastWeek} /></div>
            <small>last 7 days · week before: {dash.lastWeek}</small>
          </div>
          <Link href="/council" className="dkpi">
            <div className="dkpi-top"><span>Needs attention</span><span className={`dico ${c && c.hot ? 'red' : 'gold'}`}><Icon name="flag" size={18} /></span></div>
            <div className="dkpi-n"><b>{c ? c.hot + c.attention : '–'}</b>{c && c.hot > 0 && <span className="dchg down">{c.hot} hot</span>}</div>
            <small>{c ? `Council review · ${shortDate(c.at)}` : 'No council review yet'}</small>
          </Link>
          <div className="dkpi">
            <div className="dkpi-top"><span>Process forms</span><span className="dico blue"><Icon name="file" size={18} /></span></div>
            <div className="dkpi-n"><b>{dash.forms.submitted.length}</b><span className="dof">/ {dash.forms.total}</span></div>
            <small>{dash.forms.waiting.length ? `${dash.forms.waiting.length} still to send` : 'Everyone has sent one'}</small>
          </div>
        </section>

        <div className="drow">
          <ActivityChart days={dash.days} />
          <section className="dcard dgauge-card" aria-labelledby="pg-title">
            <div className="dcard-h"><div><h2 id="pg-title">Hub progress</h2><p className="muted small">Share of all automations that are live</p></div></div>
            <Gauge pct={pct} label="live" />
            <div className="dminis">
              <div><span>Live</span><b>{counts.live}</b><em className="seg-live" /></div>
              <div><span>In progress</span><b>{counts.building}</b><em className="seg-building" /></div>
            </div>
          </section>
        </div>

        <div className="drow">
          <DeptOverview depts={depts} all={all} />
          <section className="dcard dglance" aria-labelledby="qg-title">
            <div className="dcard-h"><div><h2 id="qg-title">Quick glance</h2><p className="muted small">What needs you today</p></div></div>
            <div className="dg-block">
              <h3>Council</h3>
              {c ? (
                <>
                  <p className="small" style={{ margin: 0 }}>{c.headline}</p>
                  {c.top.length > 0 && <ul className="dg-list">{c.top.map((t, i) => <li key={i}><span className={`dtag t-${t.tag}`}>{t.tag === 'hot' ? 'Hot' : 'Attention'}</span>{t.title}</li>)}</ul>}
                  <Link href="/council" className="linkbtn">Open the Council and the Judge</Link>
                </>
              ) : <p className="muted small" style={{ margin: 0 }}>No review yet. The council runs every morning.</p>}
            </div>
            <div className="dg-block">
              <h3>Integrations</h3>
              <ul className="dg-ints">{dash.integrations.map((i) => <li key={i.name}><i className={i.ok ? 'ok' : 'off'} />{i.name}{i.note && <span className="muted"> · {i.note}</span>}</li>)}</ul>
            </div>
            <div className="dg-block">
              <h3>Waiting on process forms</h3>
              {dash.forms.waiting.length ? <p className="small" style={{ margin: 0 }}>{dash.forms.waiting.join(', ')}</p> : <p className="muted small" style={{ margin: 0 }}>Everyone has sent theirs.</p>}
            </div>
          </section>
        </div>

        <ActivityTable rows={dash.rows} />

        <section className="dcard" aria-labelledby="updates-title">
          <div className="dcard-h"><div><h2 id="updates-title">Updates &amp; announcements</h2><p className="muted small">Team members see these at the top of their workspace</p></div></div>
          <Announcements items={updates} admin limit={5} preview={preview} departments={DEPARTMENTS.filter((d) => !d.hidden).map((d) => ({ id: d.id, name: d.name }))} />
        </section>

        {mine.length > 0 && (
          <section className="dcard">
            <div className="dcard-h"><div><h2>My automations</h2></div></div>
            <div className="list">
              {mine.map((a) => (
                <Link key={a.id} href={`/w/${a.department}?t=${a.id}`} className="item">
                  <span className="num">{a.n ? String(a.n).padStart(2, '0') : '★'}</span>
                  <div><h3>{a.title}</h3><p>{a.summary}</p></div>
                  <div className="side"><StagePill a={a} /></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="dcard">
          <div className="dcard-h"><div><h2>Preview someone’s view</h2><p className="muted small">See the hub exactly as a team member does. Read-only: nothing can be sent or changed, and their chats stay hidden.</p></div></div>
          <div className="row">
            {PEOPLE.filter((p) => p.role !== 'super_admin').map((p) => <a key={p.id} className="chip" href={`/api/preview?as=${p.id}`}>{p.name}</a>)}
          </div>
        </section>
      </main>
    </>
  );
}
