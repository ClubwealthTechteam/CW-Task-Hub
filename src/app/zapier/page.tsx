import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { isSuperAdmin } from '@/lib/access';
import { personById } from '@/config/people';
import { zapierHooks } from '@/lib/integrations/zapier';
import { inboxConfigured, listFeed } from '@/lib/integrations/zapier-feed';
import { ZapierHub } from './ZapierHub';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zapier · CW AI Task Hub' };

export default async function ZapierPage() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) notFound();
  const secret = process.env.ZAPIER_INBOUND_SECRET;
  return (
    <>
      <Header user={user} current="zapier" />
      <ZapierHub
        initialFeed={(await listFeed()).map((e) => ({ ...e, byName: e.by ? personById(e.by)?.name ?? e.by : undefined }))}
        zaps={Object.keys(zapierHooks())}
        inboxUrl={inboxConfigured() && secret ? `https://cw-ai-task-hub.vercel.app/api/zapier/inbox?key=${encodeURIComponent(secret)}` : null}
      />
    </>
  );
}
