import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { canViewEventbrite } from '@/lib/integrations/eventbrite/access';
import { eventbriteConfigured } from '@/lib/integrations/eventbrite/client';
import { EventbriteExplorer } from './EventbriteExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Eventbrite · CW AI Task Hub' };

export default async function EventbritePage() {
  const user = await requireUser();
  if (!canViewEventbrite(user)) notFound();
  return (
    <>
      <Header user={user} current="eventbrite" />
      <EventbriteExplorer connected={eventbriteConfigured()} />
    </>
  );
}
