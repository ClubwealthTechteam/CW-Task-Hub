import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { canUseReality } from '@/lib/reality/batches';
import { RealityReview } from './RealityReview';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'REality emails · CW AI Task Hub' };

export default async function RealityPage() {
  const user = await requireUser();
  if (!canUseReality(user)) notFound();
  return (
    <>
      <Header user={user} current="reality" />
      <main className="page rl-page">
        <section className="hero">
          <span className="eyebrow">Client Care · REality referrals</span>
          <h1>REality intro emails</h1>
          <p>People who ticked “Recruiting” on their half-day form. Review the list, check the email, untick anyone who shouldn’t get it, then press Send. Each person gets the intro from Admin Client Care (cc Mona &amp; Jessica), their Keap “Intro Email” task is completed, and Jessica gets the list.</p>
        </section>
        <RealityReview />
      </main>
    </>
  );
}
