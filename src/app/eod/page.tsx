// EOD reports: team members write and submit their end-of-day report here instead of emailing it;
// super admins read everyone's as they come in.

import { Header } from '@/components/Header';
import { getViewer, requireUser } from '@/lib/auth/current-user';
import { DEPARTMENTS } from '@/config/departments';
import { canReadAllEod, eodPeople } from '@/lib/eod/store';
import { EodBoard } from '@/components/eod/EodBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'EOD reports · CW AI Task Hub' };

export default async function EodPage() {
  const user = await requireUser();
  const preview = Boolean((await getViewer())?.preview);
  const read = canReadAllEod(user);
  const people = eodPeople().map((p) => ({ id: p.id, name: p.name, dept: DEPARTMENTS.find((d) => d.id === p.departments[0])?.name ?? '' }));
  return (
    <>
      <Header user={user} current="eod" />
      <main className="page eod">
        <section className="hero">
          <span className="eyebrow">EOD reports</span>
          <h1>{read ? 'Team EOD reports' : 'My EOD report'}</h1>
          <p>{read
            ? 'Every end-of-day report in one place, live as each person submits, including ours. Open one and ask the CW Assistant which tasks could be automated, or switch to My EOD report to fill in yours.'
            : 'Your end-of-day report lives here now, instead of email. Paste it straight from your EOD sheet or type it in, tick the tasks you do every day, and submit at the end of your shift.'}</p>
        </section>
        <EodBoard team={read} people={people} readOnly={preview} />
      </main>
    </>
  );
}
