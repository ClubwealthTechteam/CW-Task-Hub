// The CW Hub Council (super admins): six AI agents that check the hub every morning and report here.

import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { getViewer, requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { CouncilBoard } from './CouncilBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Council · CW AI Task Hub' };

export default async function CouncilPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  const preview = Boolean((await getViewer())?.preview);
  return (
    <>
      <Header user={user} current="council" />
      <main className="page council">
        <section className="hero">
          <span className="eyebrow">Super admins</span>
          <h1>CW Hub Council</h1>
          <p>Six AI agents check the hub every morning: bugs and connections, accuracy against Keap, the backend, the data, compliance, and a plan B for anything that breaks. They only read and advise; nothing in Keap or anywhere else is changed.</p>
        </section>
        <CouncilBoard readOnly={preview} />
      </main>
    </>
  );
}
