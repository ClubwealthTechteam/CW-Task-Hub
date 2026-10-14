// Home page for team members (everyone who isn't a super admin): their urgent tasks and to-do list, a
// Claude shift summary maker, the newest Keap contacts and Club Wealth's upcoming events.

import Link from 'next/link';
import type { Person } from '@/config/people';
import { departmentById } from '@/config/departments';
import { allAutomations } from '@/data/catalog';
import { canViewAutomation } from '@/lib/access';
import { canLookUpKeap } from '@/lib/integrations/keap/access';
import { usageFor } from '@/lib/chat/usage';
import { listItems } from '@/lib/home/items';
import { newKeapContacts, upcomingEvents, type Feed } from '@/lib/home/feeds';
import { announcementsFor, toView } from '@/lib/announcements';
import { UpdatesBanner } from '@/components/Announcements';
import { Icon } from '@/components/Icon';
import { MyLists } from './MyLists';
import { ShiftSummary } from './ShiftSummary';

const TZ = 'America/Los_Angeles';
const ago = (iso: string | null) => {
  if (!iso) return '';
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const eventDate = (local: string | null) => {
  if (!local) return { day: '–', mon: '', time: '' };
  const d = new Date(local);
  return {
    day: String(d.getDate()),
    mon: d.toLocaleDateString('en-US', { month: 'short' }),
    time: d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
  };
};
function feedNote<T>(f: Feed<T>, what: string) {
  if (f.ok) return null;
  return <p className="muted small" style={{ margin: 0 }}>{f.reason === 'not-connected' ? `${what} isn’t connected yet.` : `${what} couldn’t be read just now. Try again in a minute.`}</p>;
}

export async function MemberHome({ user, preview }: { user: Person; preview: boolean }) {
  const keapOk = canLookUpKeap(user);
  const [items, usage, tasks, keap, events, announcements] = await Promise.all([
    listItems(user.id), usageFor(user), allAutomations(), keapOk ? newKeapContacts() : Promise.resolve(null), upcomingEvents(), announcementsFor(user),
  ]);
  const mine = tasks.filter((a) => a.ownerId === user.id && canViewAutomation(user, a));
  const live = mine.filter((a) => a.stage === 'live').length;
  const open = items.filter((i) => !i.done);
  const urgent = open.filter((i) => i.kind === 'urgent').length;
  const hot = open.filter((i) => i.kind === 'hot').length;
  const todos = open.filter((i) => i.kind === 'todo').length;
  const first = user.name.split(/\s+/)[0];
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
  const dept = departmentById(user.departments[0]);
  const workspace = `/w/${user.departments[0]}`;

  return (
    <main className="page dash hm">
      <UpdatesBanner items={announcements.map(toView)} />
      <div className="dhead">
        <div>
          <h1>{hello}, {first}</h1>
          <p className="muted">{today} · {dept?.name ?? 'Your team'}</p>
        </div>
        <div className="row">
          <Link href="/updates" className="dbtn">Updates</Link>
          <Link href={workspace} className="dbtn primary">Open my workspace</Link>
        </div>
      </div>

      <section className="dkpis" aria-label="Your day at a glance">
        <div className="dkpi hi">
          <div className="dkpi-top"><span>Urgent now</span><span className="dico"><Icon name="flag" size={18} /></span></div>
          <b>{urgent}</b>
          <small>{hot ? `${hot} hot after that` : 'Nothing else marked hot'}</small>
        </div>
        <div className="dkpi">
          <div className="dkpi-top"><span>To-dos open</span><span className="dico dark"><Icon name="file" size={18} /></span></div>
          <b>{todos}</b>
          <small>{items.filter((i) => i.done && i.doneAt && Date.now() - i.doneAt < 86_400_000).length} ticked off in the last day</small>
        </div>
        <Link href={workspace} className="dkpi">
          <div className="dkpi-top"><span>My automations</span><span className="dico gold"><Icon name="spark" size={18} /></span></div>
          <div className="dkpi-n"><b>{live}</b><span className="dof">/ {mine.length}</span></div>
          <small>live · open your workspace</small>
        </Link>
        <div className="dkpi">
          <div className="dkpi-top"><span>Assistant messages</span><span className="dico blue"><Icon name="chat" size={18} /></span></div>
          <div className="dkpi-n"><b>{usage.left ?? '∞'}</b>{usage.limit != null && <span className="dof">/ {usage.limit}</span>}</div>
          <small>left today · resets at midnight PT</small>
        </div>
      </section>

      <div className="hm-two">
        <MyLists initial={items} readOnly={preview} />
      </div>

      <ShiftSummary readOnly={preview} firstName={first} />

      <div className={keap ? 'hm-two' : ''}>
        {keap && (
          <section className="dcard" aria-labelledby="hm-keap">
            <div className="dcard-h"><div><h2 id="hm-keap">New Keap contacts</h2><p className="muted small">Newest first · read-only, from Keap</p></div></div>
            {feedNote(keap, 'Keap')}
            {keap.ok && (keap.items.length ? (
              <ul className="hm-feed">
                {keap.items.map((c) => (
                  <li key={c.id}>
                    <span className="dava" aria-hidden="true">{c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <span className="hm-feed-main"><b>{c.name}</b><span className="muted small">{c.email ?? 'no email on file'}</span></span>
                    <span className="hm-feed-side muted small">{ago(c.created)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted small" style={{ margin: 0 }}>No contacts yet.</p>)}
          </section>
        )}
        <section className="dcard" aria-labelledby="hm-events">
          <div className="dcard-h"><div><h2 id="hm-events">Upcoming events</h2><p className="muted small">From Eventbrite · tickets sold so far</p></div></div>
          {feedNote(events, 'Eventbrite')}
          {events.ok && (events.items.length ? (
            <ul className="hm-feed">
              {events.items.map((e) => {
                const d = eventDate(e.start);
                const pct = e.sold != null && e.capacity ? Math.min(100, Math.round((e.sold / e.capacity) * 100)) : null;
                return (
                  <li key={e.id}>
                    <span className="hm-cal" aria-hidden="true"><b>{d.day}</b><small>{d.mon}</small></span>
                    <span className="hm-feed-main">
                      {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer"><b>{e.name}</b></a> : <b>{e.name}</b>}
                      <span className="muted small">{d.time} · {e.where}</span>
                      {pct != null && <span className="hm-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
                    </span>
                    <span className="hm-feed-side small">{e.sold != null ? <><b>{e.sold}</b>{e.capacity ? <span className="muted"> / {e.capacity}</span> : null}<br /><span className="muted">sold</span></> : <span className="muted">–</span>}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted small" style={{ margin: 0 }}>No upcoming live events.</p>)}
        </section>
      </div>
    </main>
  );
}
