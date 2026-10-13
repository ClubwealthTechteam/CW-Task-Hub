// Every update and announcement meant for this person, newest first (pinned on top).

import { Header } from '@/components/Header';
import { getViewer, requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { DEPARTMENTS } from '@/config/departments';
import { announcementsFor, toView } from '@/lib/announcements';
import { Announcements } from '@/components/Announcements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Updates · CW AI Task Hub' };

export default async function UpdatesPage() {
  const user = await requireUser();
  const preview = Boolean((await getViewer())?.preview);
  const updates = (await announcementsFor(user)).map(toView);
  const admin = isSuperAdmin(user);
  return (
    <>
      <Header user={user} current="updates" />
      <main className="page updates">
        <section className="hero">
          <span className="eyebrow">Updates</span>
          <h1>What’s new in the AI Task Hub</h1>
          <p>Announcements from Miguel, Camille and Omerson: new features, changes to your tasks, and anything the team should know.</p>
        </section>
        <section className="card">
          <Announcements items={updates} admin={admin} preview={preview} departments={DEPARTMENTS.filter((d) => !d.hidden).map((d) => ({ id: d.id, name: d.name }))} />
        </section>
      </main>
    </>
  );
}
