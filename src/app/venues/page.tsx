import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { requireUser } from '@/lib/auth/current-user';
import { canUseVenues, VENUE_STATUSES, VENUE_TYPES } from '@/lib/venues/info';
import { VENUES_MAP_ID, venuesEditUrl } from '@/lib/venues/map';
import { VenuesExplorer } from './VenuesExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Venues · CW AI Task Hub' };

export default async function VenuesPage() {
  const user = await requireUser();
  if (!canUseVenues(user)) notFound();
  return (
    <>
      <Header user={user} current="venues" />
      <VenuesExplorer mapId={VENUES_MAP_ID} editUrl={venuesEditUrl()} types={[...VENUE_TYPES]} statuses={[...VENUE_STATUSES]} />
    </>
  );
}
